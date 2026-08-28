import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException } from "@nestjs/common";

import { DataSource, EntityManager, Not, IsNull } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import * as otplib from "otplib";

import { TokenService } from "src/tokens/tokens.service";
import { MailerService } from "src/mailer/mailer.service";

import { CredentialStatus } from "./credential-status.enum";
import { TokenType } from "src/tokens/token-type.enum";
import { MailerTemplate, MailerURL, MailerEndpoint, MailerSubject, EmailMessage } from "src/mailer/mailer.enums";

import { Credential } from "./entities/credentials-entity";
import { UserProfile } from "src/users/entities/user-profile-entity";

import { MFAEnrollmentDTO, CredAuthDTO, MFAAuthDTO, ResetPasswordDTO, ChangePasswordDTO, ReactivationDTO } from "./dtos/credentials-dtos";

@Injectable()
export class CredentialsService {
    private readonly encryptKey: string;
    private readonly algorithm = "aes-256-cbc";

    constructor(
        private readonly tokenService: TokenService,
        private readonly mailerService: MailerService,
        
        private readonly dataSource: DataSource,

        private readonly configService: ConfigService
    ) {
        const key = this.configService.get<string>("ENCRYPTION_KEY");

        if (!key) {
            throw new Error(`Credentials-Service | CRITICAL ERROR: "ENCRYPTION_KEY" is undefined.`);
        }

        this.encryptKey = key;
    }

    encrypt(text: string): Buffer {
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptKey, "hex"), iv);

        let encrypted = cipher.update(text);

        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return Buffer.concat([iv, encrypted]);
    }

    decrypt(text: Buffer): string {
        const iv = text.subarray(0, 16);

        const encryptedText = text.subarray(16);

        const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptKey, "hex"), iv);

        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    }

    async createCredentials(profileId: number, identifier: string, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        const credReference = await repo.exists({
            where: {
                identifier: identifier,
                status: Not(CredentialStatus.PENDING)
            }
        });

        if (credReference) {
            throw new ConflictException("Credentials-Service | CC-01: This information is already in use");
        }

        const newCredential = repo.create({
            profile: { profileId: profileId },
            identifier: identifier,
            // passwordHash:
            // mfaEnrolled:
            // encryptedMfaSecret:
            // mfaSecretIssuedAt:

            // failedAttempts:
            // lockedUntil:
            // status:
        });

        const credential = await repo.save(newCredential);

        const activationToken = await this.tokenService.generateToken(
            credential.credId,
            TokenType.ACTIVATION,
            "SYSTEM_ACTIVATION_FLOW",
            manager
        );

        return activationToken;
    }

    async hashPassword(password: string) {
        return await bcrypt.hash(password, 10);
    }

    async activateCredentials(credId: number, hashedPassword: string, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        await repo.update(credId, {
            passwordHash: hashedPassword,
        });
    }

    private async generateMFAData(email: string, credId: number, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        const key = otplib.generateSecret();
        
        const otpAuthUrl = otplib.generateURI({
            issuer: "BRUTE",
            label: email,
            secret: key
        });

        const encryptedKey = this.encrypt(key);

        await repo.update(credId, {
            encryptedMfaSecret: encryptedKey,
            mfaSecretIssuedAt: new Date(),
        });

        return {
            key,
            otpAuthUrl
        };
    }

    async initiateMFAEnrollment(email: string, credId: number) {
        return await this.dataSource.transaction(async (manager) => {
            const { key, otpAuthUrl } = await this.generateMFAData(email, credId, manager);

            return {
                key,
                otpAuthUrl
            };
        });
    }

    async mfaEnrollment(dto: MFAEnrollmentDTO, credential: Credential, tokenId: number) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                if (!credential.encryptedMfaSecret) {
                    throw new InternalServerErrorException("Credentials-Service | MFAE-01: Invalid request.");
                }

                const decryptedKey = this.decrypt(credential.encryptedMfaSecret);

                if ((await otplib.verify({token: dto.otp, secret: decryptedKey})).valid) {
                    await repo.update(credential.credId, {
                        mfaEnrolled: true,
                        status: CredentialStatus.ACTIVATED
                    });

                    await this.tokenService.revokeToken(tokenId, manager);
                } else {
                    throw new BadRequestException("Credentials-Service | MFAE-02: Invalid OTP.");
                }
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    private validateCredentialsStatus(credential: Credential) {
        switch(credential.status) {
            case CredentialStatus.PENDING:
                throw new BadRequestException("Credentials-Service | VCS-01: Credentials pending of activation.");

            case CredentialStatus.LOCKED:
                if (credential.lockedUntil && credential.lockedUntil > new Date()) {
                    throw new BadRequestException("Credentials-Service | VCS-02: Credentials temporarily suspended due to an excess of failed access attempts.");
                }

                break;

            case CredentialStatus.BLOCKED:
                throw new BadRequestException("Credentials-Service | VCS-03: Credentials blocked indefinitely.");

            case CredentialStatus.COMPROMISED:
                throw new BadRequestException("Credentials-Service | VCS-04: Credentials compromised.");

            case CredentialStatus.REACTIVATING:
                throw new BadRequestException("Credentials-Service | VCS-05: Credentials pending reactivation.");
                
            case CredentialStatus.DISABLED:
                throw new BadRequestException("Credentials-Service | VCS-06: Credentials disabled.");
                    
            default:
                break;
        }
    }

    private async attemptFailed(credential: Credential, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        const attempts = credential.failedAttempts + 1;
        let lockDate: Date | null = null;
        let status: CredentialStatus | undefined = undefined;

        switch(true) {
            case attempts === 5:
                lockDate = new Date();
                lockDate.setMinutes(lockDate.getMinutes() + 5);

                status = CredentialStatus.LOCKED;

                break;
            case attempts === 6:
                lockDate = new Date();
                lockDate.setMinutes(lockDate.getMinutes() + 10);

                break;
            case attempts === 7:
                lockDate = new Date();
                lockDate.setMinutes(lockDate.getMinutes() + 15);

                break;
            case attempts === 8:
                lockDate = new Date();
                lockDate.setMinutes(lockDate.getMinutes() + 30);

                break;
            case attempts === 9:
                lockDate = new Date();
                lockDate.setFullYear(lockDate.getFullYear() + 100);

                status = CredentialStatus.BLOCKED;

                break;
            default:
                break;
        }

        await repo.update(credential.credId, {
            failedAttempts: attempts,
            lockedUntil: lockDate,

            ...(status && { status })
        });
    }

    private async resetFailedAttempts(credential: Credential, manager: EntityManager) {
        const repo = manager.getRepository(Credential);
        
        await repo.update(credential.credId, {
            failedAttempts: 0,
            lockedUntil: null
        });
    }

    private async validateCredentials(credential: Credential, password: string, manager: EntityManager) {
        this.validateCredentialsStatus(credential);

        const isValid = await bcrypt.compare(password, credential.passwordHash ?? "");

        if (!isValid) {
            await this.attemptFailed(credential, manager);

            throw new BadRequestException("Credential-Service | VC-01: Invalid request.");
        }

        if (credential.failedAttempts > 0 || credential.lockedUntil) {
            await this.resetFailedAttempts(credential, manager);
        }
    }

    private async validateMFA(credential: Credential, otp: string, manager: EntityManager) {
        this.validateCredentialsStatus(credential);
        
        if (!credential.encryptedMfaSecret) {
            throw new InternalServerErrorException("Credentials-Service | VMFA-01: Invalid request.");
        }

        const decryptedKey = this.decrypt(credential.encryptedMfaSecret);

        const { valid: isValid } = await otplib.verify({token: otp, secret: decryptedKey});

        if (!isValid) {
            await this.attemptFailed(credential, manager);

            throw new BadRequestException("Credentials-Service | MFAuth-02: Invalid OTP.")
        }

        if (credential.failedAttempts > 0 || credential.lockedUntil) {
            await this.resetFailedAttempts(credential, manager);
        }
    }

    async credAuthentication(dto: CredAuthDTO) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                const credReference = await repo.findOne({
                    where: {
                        identifier: dto.identifier,
                        status: Not(CredentialStatus.PENDING)
                    }
                });

                if (!credReference) {
                    throw new BadRequestException("Credentials-Service | CA-01: Invalid request.");
                }

                await this.validateCredentials(credReference, dto.password, manager);

                const preAuthToken = await this.tokenService.generateToken(
                    credReference.credId,
                    TokenType.PRE_AUTH,
                    dto.userAgent,
                    manager
                );

                return preAuthToken;
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async mfaAuthentication(dto: MFAAuthDTO, name: string, email: string, credential: Credential, tokenId: number) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                await this.validateMFA(credential, dto.otp, manager);

                await this.tokenService.revokeToken(tokenId, manager);

                const sessionTokens = await this.tokenService.generateSessionTokens(
                    credential.credId,
                    dto.userAgent,
                    manager,
                    {
                        rememberMe: dto.rememberMe
                    }
                );

                const hasLoggedIn = await this.tokenService.hasLoggedInFromDevice(credential.credId, dto.userAgent, manager);

                if (!hasLoggedIn) {
                    const fraudFlagToken = await this.tokenService.generateToken(
                        credential.credId,
                        TokenType.FRAUD_FLAG,
                        "POSSIBLE_FRAUD_HANDLING_FLOW",
                        manager
                    );

                    const emailStructure = this.mailerService.buildEmail(
                        email,
                        MailerTemplate.NOTIFY_NEW_DEVICE,
                        name,
                        {
                            urlKey: MailerURL.PUBLIC_WEB_URL,
                            endpoint: MailerEndpoint.FRAUD_FLAG,
                            token: fraudFlagToken.plainToken,
                            userAgent: dto.userAgent
                        }
                    );

                    await this.mailerService.sendEmail(MailerSubject.NOTIFY_NEW_DEVICE, emailStructure);
                }

                return sessionTokens;
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    private async updatePasswordHash(credId: number, newPasswordHash: string, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        await repo.update(credId, {
            passwordHash: newPasswordHash
        });
    }

    async resetPassword(dto: ResetPasswordDTO, name: string, email: string, credId: number, tokenId: number) {
        try {
            const newPasswordHash = await this.hashPassword(dto.newPassword);

            return await this.dataSource.transaction(async (manager) => {
                await this.updatePasswordHash(credId, newPasswordHash, manager);

                await this.tokenService.revokeToken(tokenId, manager);

                const fraudFlagToken = await this.tokenService.generateToken(
                    credId,
                    TokenType.FRAUD_FLAG,
                    "POSSIBLE_FRAUD_HANDLING_FLOW",
                    manager
                );

                const emailStructure = this.mailerService.buildEmail(
                    email,
                    MailerTemplate.NOTIFY_EVENT,
                    name,
                    {
                        message: EmailMessage.NOTIFY_PASSWORD_RESET,
                        urlKey: MailerURL.PUBLIC_WEB_URL,
                        endpoint: MailerEndpoint.FRAUD_FLAG,
                        token: fraudFlagToken.plainToken
                    }
                );
                
                await this.mailerService.sendEmail(MailerSubject.NOTIFY_PASSWORD_RESET, emailStructure);
            })
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async changePassword(dto: ChangePasswordDTO, name: string, email: string, credId: number, tokenId: number) {
        try {
            const newPasswordHash = await this.hashPassword(dto.newPassword);

            return await this.dataSource.transaction(async (manager) => {
                await this.updatePasswordHash(credId, newPasswordHash, manager);

                await this.tokenService.revokeToken(tokenId, manager);

                const fraudFlagToken = await this.tokenService.generateToken(
                    credId,
                    TokenType.FRAUD_FLAG,
                    "POSSIBLE_FRAUD_HANDLING_FLOW",
                    manager
                );

                const emailStructure = this.mailerService.buildEmail(
                    email,
                    MailerTemplate.NOTIFY_EVENT,
                    name,
                    {
                        message: EmailMessage.NOTIFY_PASSWORD_CHANGE,
                        urlKey: MailerURL.PUBLIC_WEB_URL,
                        endpoint: MailerEndpoint.FRAUD_FLAG,
                        token: fraudFlagToken.plainToken
                    }
                );
                
                await this.mailerService.sendEmail(MailerSubject.NOTIFY_PASSWORD_CHANGE, emailStructure);
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async updateIdentifier(name: string, email: string, credId: number, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        await repo.update(credId, {
            identifier: email,
            mfaEnrolled: false,
            encryptedMfaSecret: null,
            mfaSecretIssuedAt: null,
            status: CredentialStatus.REACTIVATING,
        });

        const mfaReset = await this.tokenService.generateToken( 
            credId,
            TokenType.MFA_RESET,
            "EMAIL_CHANGE_FLOW",
            manager
        );

        const emailStructure = this.mailerService.buildEmail(
            email,
            MailerTemplate.MFA_RESET,
            name,
            {
                urlKey: MailerURL.PUBLIC_WEB_URL,
                endpoint: MailerEndpoint.MFA_RESET,
                token: mfaReset.plainToken,
            }
        );

        await this.mailerService.sendEmail(MailerSubject.NOTIFY_EMAIL_CHANGE, emailStructure);
    }

    async unlockCredentials(identifier: string) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                const credReference = await repo.findOne({
                    where: {
                        identifier: identifier,
                        status: CredentialStatus.BLOCKED,
                    }
                });

                if (!credReference) {
                    throw new NotFoundException("Credentials-Service | UC-01: This information is not associated to an eligible account.");
                }

                await repo.update(credReference.credId, {
                    failedAttempts: 0,
                    lockedUntil: null,
                    status: CredentialStatus.ACTIVATED,
                });
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async handleCompromisedCredentials(name: string, email: string, credId: number) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                await repo.update(credId, {
                    passwordHash: null,
                    mfaEnrolled: false,
                    encryptedMfaSecret: null,
                    mfaSecretIssuedAt: null,
                    status: CredentialStatus.COMPROMISED,
                });

                await this.tokenService.revokeAllForCredentials(credId, manager);
                
                const emailStructure = this.mailerService.buildEmail(
                    email,
                    MailerTemplate.NOTIFY_FRAUD,
                    name,
                );

                await this.mailerService.sendEmail(MailerSubject.NOTIFY_FRAUD, emailStructure);
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async startCredReactivation(identifier: string) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                const credReference = await repo.findOne({
                    where: {
                        identifier: identifier,
                        passwordHash: IsNull(),
                        mfaEnrolled: false,
                        encryptedMfaSecret: IsNull(),
                        mfaSecretIssuedAt: IsNull(),

                        status: CredentialStatus.COMPROMISED
                    },
                    relations: ["profile"]
                });

                if (!credReference) {
                    throw new NotFoundException("Credentials-Service | RC-01: This information is not associated to an eligible account.");
                }

                await repo.update(credReference.credId, {
                    status: CredentialStatus.REACTIVATING
                });

                const reactivationToken = await this.tokenService.generateToken(
                    credReference.credId,
                    TokenType.REACTIVATION,
                    "SYSTEM_REACTIVATION_FLOW",
                    manager
                );

                const emailStructure = this.mailerService.buildEmail(
                    credReference.profile.email,
                    MailerTemplate.REACTIVATION,
                    credReference.profile.name,
                    {
                        urlKey: MailerURL.PUBLIC_WEB_URL,
                        endpoint: MailerEndpoint.REACTIVATION,
                        token: reactivationToken.plainToken
                    }
                );
                
                await this.mailerService.sendEmail(MailerSubject.REACTIVATION, emailStructure);
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async reactivateCredentials(dto: ReactivationDTO, credId: number, tokenId: number) {        
        try {
            const newPasswordHash = await this.hashPassword(dto.newPassword);

            return await this.dataSource.transaction(async (manager) => {
                await this.updatePasswordHash(credId, newPasswordHash, manager);

                await this.tokenService.revokeToken(tokenId, manager);

                const mfaResetToken = await this.tokenService.generateToken(
                    credId,
                    TokenType.MFA_RESET,
                    "SYSTEM_R_MFA_RESET_FLOW",
                    manager
                );

                return mfaResetToken;
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }
}

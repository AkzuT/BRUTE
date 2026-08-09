import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException } from "@nestjs/common";

import { DataSource, EntityManager, Not, IsNull } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import * as otplib from "otplib";

import { CredentialStatus } from "./credential-status.enum";

import { Credential } from "./entities/credentials-entity";
import { UserProfile } from "src/users/entities/user-profile-entity";

import { MFAEnrollmentDTO, CredAuthDTO, MFAuthDTO, ResetPasswordDTO, ChangePasswordDTO } from "./dtos/credentials-dtos";

@Injectable()
export class CredentialsService {
    private readonly encryptKey: string;
    private readonly algorithm = "aes-256-cbc";

    constructor(
        private readonly dataSource: DataSource,

        private readonly configService: ConfigService
    ) {
        const key = this.configService.get<string>("ENCRYPTION_KEY");

        if (!key) {
            throw new Error(`Credentials-Service | CRITICAL ERROR: "ENCRYPTION_KEY" is undefined.`);
        }

        this.encryptKey = key;
    }

    encryp(text: string): Buffer {
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

        const credentialExists = await repo.exists({
            where: {
                profile: { profileId: profileId },
                identifier: identifier
            }
        });

        if (credentialExists) {
            throw new ConflictException("Credentials-Service | CC-01: This information is already in use.");
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

        await repo.save(newCredential);

        // Incluir lógica referente a la creación de tokens → "ACTIVATION".
    }

    private async generateMFAData(profile: UserProfile, credential: Credential, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        const key = otplib.generateSecret();
        
        const otpAuthUrl = otplib.generateURI({
            issuer: "BRUTE",
            label: profile.email,
            secret: key
        });

        const encryptedKey = this.encryp(key);

        await repo.update(credential.credId, {
            encryptedMfaSecret: encryptedKey,
            mfaSecretIssuedAt: new Date(),
        });

        return {
            key,
            otpAuthUrl
        };
    }

    async activateCredentials(profile: UserProfile, credential: Credential, hashedPassword: string, manager: EntityManager) {
        const repo = manager.getRepository(Credential);

        const mfaData = await this.generateMFAData(profile, credential, manager);

        const { key, otpAuthUrl } = mfaData;

        await repo.update(credential.credId, {
            passwordHash: hashedPassword,
        });

        return {
            key,
            otpAuthUrl
        };
    }

    async mfaEnrollment(dto: MFAEnrollmentDTO, credential: Credential, manager: EntityManager) {
        try {
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

                // Incluir lógica referente a la revocación de tokens → "ACTIVATION".
            } else {
                throw new BadRequestException("Credentials-Service | MFAE-02: Invalid OTP.");
            }
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    private async validateCredentialStatus(credential: Credential) {
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
        await this.validateCredentialStatus(credential);

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
        if (!credential.encryptedMfaSecret) {
            throw new InternalServerErrorException("Credentials-Service | VMFA-01: Invalid request.");
        }

        await this.validateCredentialStatus(credential);

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

                // Implementar lógica referente a la generación de tokens → "PRE_AUTH".
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async mfaAuthentication(dto: MFAuthDTO, credential: Credential) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                await this.validateMFA(credential, dto.otp, manager);

                // Implementar lógica referente a la revocación de tokens → "PRE_AUTH".
                // Implementar lógica referente a la identificación de inicio de sesión desde un nuevo dispositivo.
                // Implementar lógica referente a la generación de tokens → "REFRESH" - "SESSION".
                
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async resetPassword(dto: ResetPasswordDTO) {
        try {
            const credential = await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                const credReference = await repo.findOne({
                    where: {
                        identifier: dto.mfaData.identifier,
                    }
                });

                if (!credReference) {
                    throw new InternalServerErrorException("Credentials-Service | RP-01: This information is not associated to an eligible account.");
                }

                await this.validateMFA(credReference, dto.mfaData.otp, manager);

                return credReference;
            });

            const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                await repo.update(credential.credId, {
                    passwordHash: newPasswordHash
                });

                // Implementar lógica referente a la generación de tokens → "FRAUD_FLAG".
                // Implementar lógica referente a la notificación de usuarios via correo → Reinicio de contraseña exitoso.
            })
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async changePassword(dto: ChangePasswordDTO) {
        try {
            const credential = await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                const credReference = await repo.findOne({
                    where: {
                        identifier: dto.credentials.identifier
                    }
                });

                if (!credReference) {
                    throw new InternalServerErrorException("Credentials-Service | CP-01: This information is not associated to an eligible account.");
                }

                await this.validateCredentials(credReference, dto.credentials.password, manager);

                await this.validateMFA(credReference, dto.mfaData.otp, manager);

                return credReference;
            });

            const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                await repo.update(credential.credId, {
                    passwordHash: newPasswordHash
                });

                // Implementar lógica referente a la generación de tokens → "FRAUD_FLAG".
                // Implementar lógica referente a la notificación de usuarios via correo → Cambio de contraseña exitoso.
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
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

    async handleCompromisedCredentials(credential: Credential) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(Credential);

                await repo.update(credential.credId, {
                    passwordHash: null,
                    mfaEnrolled: false,
                    encryptedMfaSecret: null,
                    mfaSecretIssuedAt: null,
                    status: CredentialStatus.COMPROMISED,
                });

                // Implementar lógica referente a la revocatión de tokens → TODAS.
                // Implementar lógica referente a la notificación de usuarios via correo → Cuenta bloqueada para evitar uso fraudulento.
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }

    async reactivateCredentials(identifier: string) {
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

                // Implementar lógica referente a la generación de tokens → "REACTIVATION".
                // Implementar lógica referente a la notificación de usuarios via correo → Correo de seguimiento para reactivación de cuenta.
            });
        } catch (error) {
            console.error("Credentials-Service | Error: ", error);
            throw error;
        }
    }
}

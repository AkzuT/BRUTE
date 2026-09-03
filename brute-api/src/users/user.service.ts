import { Injectable, ConflictException, BadRequestException, NotFoundException } from "@nestjs/common";

import { DataSource, EntityManager } from "typeorm";

import * as fs from "fs";
import { join } from "path";

import { User } from "./entities/user-entity";
import { UserPhone } from "./entities/user-phone-entity";
import { UserProfile } from "./entities/user-profile-entity";

import { ProfileType } from "./profile-type.enum";
import { TokenType } from "src/tokens/token-type.enum";
import { MailerTemplate, MailerURL, MailerEndpoint, MailerSubject, EmailMessage } from "src/mailer/mailer.enums";

import { RegUserUnprivileged, RegUserPrivileged, UpdateProfileDTO } from "./dtos/user-dtos";

import { CredentialsService } from "src/credentials/credentials.service";
import { TokenService } from "src/tokens/tokens.service";
import { MailerService } from "src/mailer/mailer.service";

type RegUserBase = RegUserUnprivileged | RegUserPrivileged;

@Injectable()
export class UserService {
    constructor(
        private readonly dataSource: DataSource,

        private readonly credentialsService: CredentialsService,

        private readonly tokenService: TokenService,

        private readonly mailerService: MailerService,
    ) {}

    private readonly ACTIVATION_MAILER: Record <ProfileType, { template: MailerTemplate; endpoint: MailerEndpoint; subject: MailerSubject }> = {
        [ProfileType.UNPRIVILEGED]: {
            template: MailerTemplate.UNPRIVILEGED_ACTIVATION,
            endpoint: MailerEndpoint.UNPRIVILEGED_ACTIVATION,
            subject: MailerSubject.UNPRIVILEGED_ACTIVATION,
        },
        [ProfileType.PRIVILEGED]: {
            template: MailerTemplate.PRIVILEGED_ACTIVATION,
            endpoint: MailerEndpoint.PRIVILEGED_ACTIVATION,
            subject: MailerSubject.PRIVILEGED_ACTIVATION,
        },
    };

    private async addUser(userId: string, manager: EntityManager) {
        const repo = manager.getRepository(User);

        const userExists = await repo.exists({
            where: { userId: userId }
        });

        if (userExists) {
            return;
        }

        const newUser = repo.create({
            userId: userId
        });

        await repo.save(newUser);
    }

    private async managePhone(phone: string, userId: string, revealDetails: boolean, manager: EntityManager) {
        const repo = manager.getRepository(UserPhone);

        const phoneRegistered = await repo.exists({
            where: {
                phone: phone
            }
        });

        if (!phoneRegistered) {
            const newPhone = repo.create({
                phone: phone,
                user: { userId: userId }
            });

            return await repo.save(newPhone);
        }

        const phoneRegisteredToUser = await repo.exists({
            where: {
                phone: phone,
                user: { userId: userId }
            }
        });

        if (!phoneRegisteredToUser) {
            throw new ConflictException(
                revealDetails ? "Users-Service | VP-01: The PHONE that wants to be registered is already in use." : "Users-Service | VP-01: The information provided is already in use."
            );
        }
    }

    private async addProfile(dto: RegUserBase, type: ProfileType, file: Express.Multer.File, revealDetails: boolean, manager: EntityManager) {
        if (type === ProfileType.PRIVILEGED && !file) {
            throw new BadRequestException("Users-Service | AP-01: The PROFILE PICTURE is mandatory for privileged profiles.");
        }

        const repo = manager.getRepository(UserProfile);

        const profileExists = await repo.exists({
            where: {
                user: { userId: dto.user.userId },
                profileType: type
            }
        });

        if (profileExists) {
            throw new ConflictException(
                revealDetails ? "Users-Service | AP-02: The provided ID is already registered for a privileged profile" : "Users-Service | AP-02: The information provided is already in use."
            );
        }

        await this.managePhone(dto.profile.phone, dto.user.userId, revealDetails, manager);

        const newProfile = repo.create({
            user: { userId: dto.user.userId },
            profileType: type,
            name: dto.profile.name,
            firstLastName: dto.profile.firstLastName,
            secondLastName: dto.profile.secondLastName,
            profilePicture: file ? file.filename : "default-profile-picture.png",
            email: dto.profile.email,
            phone: dto.profile.phone,
        });

        return await repo.save(newProfile);
    }

    private async registerUser(
        dto: RegUserBase,
        type: ProfileType,
        file: Express.Multer.File,
        revealDetails: boolean,
        manager: EntityManager
    ) {
        await this.addUser(dto.user.userId, manager);
        return this.addProfile(dto, type, file, revealDetails, manager);   
    }

    private async sendActivationEmail(profile: UserProfile, type: ProfileType, activationToken: string) {
        const { template, endpoint, subject } = this.ACTIVATION_MAILER[type];

        const emailStructure = this.mailerService.buildEmail(
            profile.email, 
            template, profile.name,
            {
                urlKey: MailerURL.PUBLIC_WEB_URL,
                endpoint: endpoint,
                token: activationToken,
            }
        );

        await this.mailerService.sendEmail(subject, emailStructure);
    }

    async registerUnprivilegedUser(dto: RegUserUnprivileged, file: Express.Multer.File) {
        try {
            const hashedPassword = await this.credentialsService.hashPassword(dto.password.password);

            return await this.dataSource.transaction(async (manager) => {
                const profile = await this.registerUser(dto, ProfileType.UNPRIVILEGED, file, false, manager);

                const { credId, plainToken } = await this.credentialsService.createCredentials(profile.profileId, profile.email, manager);

                await this.credentialsService.activateCredentials(credId, hashedPassword, manager);

                await this.sendActivationEmail(profile, ProfileType.UNPRIVILEGED, plainToken);
            });

        } catch (error) {
            if (file) await fs.promises.unlink(file.path).catch(() => {});

            console.error("Users-Service | Error: ", error);
            throw error;
        }
    }

    async registerPrivilegedUser(dto: RegUserPrivileged, file: Express.Multer.File) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const profile = await this.registerUser(dto, ProfileType.PRIVILEGED, file, true, manager);

                const { plainToken } = await this.credentialsService.createCredentials(profile.profileId, profile.email, manager);

                await this.sendActivationEmail(profile, ProfileType.PRIVILEGED, plainToken);
            });
        } catch (error) {
            if (file) await fs.promises.unlink(file.path).catch(() => {});

            console.error("Users-Service | Error: ", error);
            throw error;
        }
    }

    async updateProfile(profileId: number, dto: UpdateProfileDTO, file: Express.Multer.File | undefined) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const repo = manager.getRepository(UserProfile);

                const profileReference = await repo.findOne({
                    where: {
                        profileId: profileId
                    }
                });

                if (!profileReference) {
                    throw new NotFoundException("Users-Service | UP-01: Reference lost.");
                }

                const previousPicture = profileReference.profilePicture;

                await repo.update(profileId, {
                    ...(dto.name && { name: dto.name }),
                    ...(dto.firstLastName && { firstLastName: dto.firstLastName }),
                    ...(dto.secondLastName !== undefined && { secondLastName: dto.secondLastName }),
                    ...(file && { profilePicture: file.filename }),
                });

                if (file && previousPicture !== "default-profile-picture.png") {
                    await fs.promises.unlink(join("./profile-pictures", previousPicture)).catch(() => {});
                }
                
                return repo.findOne({
                    where: {
                        profileId: profileId
                    }
                });
            });

        } catch (error) {
            if (file) await fs.promises.unlink(file.path).catch(() => {});

            console.error("Users-Service | Error: ", error);
            throw error;
        }
    }

    private async startSensitiveOperation(
        credId: number,
        type: TokenType.PASSWORD_CHANGE | TokenType.EMAIL_CHANGE | TokenType.PHONE_CHANGE,
        mailer: { template: MailerTemplate; endpoint: MailerEndpoint; subject: MailerSubject },
        name: string,
        email: string,
        manager: EntityManager
    ) {
        const { plainToken } = await this.tokenService.generateToken(
            credId,
            type,
            "SENSITIVE_OPERATION_START_FLOW",
            manager
        );

        const emailStructure = this.mailerService.buildEmail(email, mailer.template, name, {
            urlKey: MailerURL.PUBLIC_WEB_URL,
            endpoint: mailer.endpoint,
            token: plainToken
        });

        await this.mailerService.sendEmail(mailer.subject, emailStructure);
    }

    async initiatePasswordChange(name: string, email: string, credId: number) {
        return this.dataSource.transaction(async (manager) => {
            await this.startSensitiveOperation(
                credId,
                TokenType.PASSWORD_CHANGE,
                {
                    template: MailerTemplate.PASSWORD_CHANGE,
                    endpoint: MailerEndpoint.PASSWORD_CHANGE,
                    subject: MailerSubject.PASSWORD_CHANGE,
                },
                name,
                email,
                manager
            );
        });
    }

    async initiateEmailChange(name: string, email: string, credId: number) {
        return this.dataSource.transaction(async (manager) => {
            await this.startSensitiveOperation(
                credId,
                TokenType.EMAIL_CHANGE,
                {
                    template: MailerTemplate.EMAIL_CHANGE,
                    endpoint: MailerEndpoint.EMAIL_CHANGE,
                    subject: MailerSubject.EMAIL_CHANGE,
                },
                name,
                email,
                manager
            );
        });
    }

    async requestEmailChange(
        name: string,
        newEmail: string,
        credId: number,
        tokenId: number,
    ) {
        return await this.dataSource.transaction(async (manager) => {
            await this.tokenService.revokeToken(tokenId, manager);
            
            const { plainToken } = await this.tokenService.generateToken(
                credId,
                TokenType.EMAIL_CHANGE,
                "EMAIL_CHANGE_CONFIRMATION_FLOW",
                manager,
            );

            const signature = this.mailerService.signURL(newEmail);
            const emailStructure = this.mailerService.buildEmail(newEmail, MailerTemplate.EMAIL_CONFIRM_CHANGE, name, {
                urlKey: MailerURL.PUBLIC_WEB_URL,
                endpoint: MailerEndpoint.EMAIL_CONFIRM_CHANGE,
                token: plainToken,
                emailToSign: newEmail,
                sig: signature,
            });

            await this.mailerService.sendEmail(MailerSubject.EMAIL_CONFIRM_CHANGE, emailStructure);
        });
    }

    async confirmEmailChange(
        profileId: number,
        name: string,
        oldEmail: string,
        newEmail: string,
        credId: number,
        signature: string,
    ) {
        if (!this.mailerService.verifyURLSignature(newEmail, signature)) {
            throw new BadRequestException("Users-Service | CEC-01: Invalid or tampered confirmation link.");
        }

        return await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(UserProfile);

            await this.credentialsService.updateIdentifier(name, oldEmail, newEmail, credId, manager);

            await repo.update(profileId, { email: newEmail });

            await this.credentialsService.logOutAll(credId, manager);
        });
    }

    async initiatePhoneChange(name: string, email: string, credId: number) {
        return this.dataSource.transaction(async (manager) => {
            await this.startSensitiveOperation(
                credId,
                TokenType.PHONE_CHANGE,
                {
                    template: MailerTemplate.PHONE_CHANGE,
                    endpoint: MailerEndpoint.PHONE_CHANGE,
                    subject: MailerSubject.PHONE_CHANGE,
                },
                name,
                email,
                manager
            );
        });
    }

    async updatePhone(
        userId: string,
        profileId: number,
        name: string,
        email: string,
        newPhone: string,
        credId: number,
        tokenId: number,
    ) {
        return this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(UserProfile);

            await this.managePhone(newPhone, userId, true, manager);

            await repo.update(profileId, {
                phone: newPhone
            });

            const { plainToken } = await this.tokenService.generateToken(
                credId,
                TokenType.FRAUD_FLAG,
                "POSSIBLE_FRAUD_HANDLING_FLOW",
                manager,
            );

            const emailStructure = this.mailerService.buildEmail(email, MailerTemplate.NOTIFY_EVENT, name, {
                message: EmailMessage.NOTIFY_PHONE_CHANGE,
                urlKey: MailerURL.PUBLIC_WEB_URL,
                endpoint: MailerEndpoint.FRAUD_FLAG,
                token: plainToken,
            });

            await this.mailerService.sendEmail(MailerSubject.NOTIFY_PHONE_CHANGE, emailStructure);

            await this.tokenService.revokeToken(tokenId, manager);
        });
    }

    async localLogOut(credId: number, userAgent: string) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                await this.credentialsService.localLogOut(credId, userAgent, manager);
            });
        } catch (error) {
            console.error("Users-Service | Error: ", error);
            throw error;
        }
    }

    async selectedLogOut(credId: number, userAgent: string) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                await this.credentialsService.selectedLogOut(credId, userAgent, manager);
            });
        } catch (error) {
            console.error("Users-Service | Error: ", error);
            throw error;
        }
    }

    async logOutAll(credId: number) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                await this.credentialsService.logOutAll(credId, manager);
            });
        } catch (error) {
            console.error("Users-Service | Error: ", error);
            throw error;
        }
    }
}

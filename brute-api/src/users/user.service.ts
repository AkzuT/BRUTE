import { Injectable, ConflictException, BadRequestException, NotFoundException, InternalServerErrorException, Inject } from "@nestjs/common";

import { DataSource, Repository, EntityManager } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import * as fs from "fs";
import { join } from "path";

import { User } from "./entities/user-entity";
import { UserPhone } from "./entities/user-phone-entity";
import { UserProfile } from "./entities/user-profile-entity";

import { RegUserUnprivileged, RegUserPrivileged } from "./dtos/user-dtos";
import { ProfileType } from "./profile-type.enum";

import { CredentialsService } from "src/credentials/credentials.service";
import { MailerService } from "src/mailer/mailer.service";
import { MailerTemplate, MailerURL, MailerEndpoint, MailerSubject } from "src/mailer/mailer.enums";
import { TokenType } from "src/tokens/token-type.enum";
import { TokenService } from "src/tokens/tokens.service";

type RegUserBase = RegUserUnprivileged | RegUserPrivileged;

@Injectable()
export class UserService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly credentialsService: CredentialsService,
        private readonly tokenService: TokenService,
        private readonly mailerService: MailerService,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(UserProfile)
        private readonly profileRepo: Repository<UserProfile>
    ) {}

    private readonly ACTIVATION_MAILER: Record <
        ProfileType,
        { template: MailerTemplate; endpoint: MailerEndpoint; subject: MailerSubject }
    > = {
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
                revealDetails
                    ? "User-Service | VP-01: El TELÉFONO que quiere registrar ya está en uso."
                    : "User-Service | VP-01: The information provided is already in use."
            );
        }
    }

    private async addProfile(dto: RegUserBase, type: ProfileType, file: Express.Multer.File | undefined, revealDetails: boolean, manager: EntityManager) {
        if (type === "PRIVILEGED" && !file) {
            throw new BadRequestException(
                "User-Service | AP-01: El registro de PERFILES PRIVILEGIADOS requiere, obligatoriamente, una foto de perfil."
            );
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
                revealDetails
                ? "User-Service | AP-02: An account already exists for this User ID and Profile Type."
                : "User-Service | AP-02: An account with this information already exists. Please try again."
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
        file: Express.Multer.File | undefined,
        revealDetails: boolean,
        manager: EntityManager,
    ) {
        await this.addUser(dto.user.userId, manager);
        return this.addProfile(dto, type, file, revealDetails, manager);   
    }

    private async sendActivationEmail(profile: UserProfile, type: ProfileType, activateToken: string) {
        const { template, endpoint, subject } = this.ACTIVATION_MAILER[type];

        const emailStructure = this.mailerService.buildEmail(profile.email, template, profile.name, {
            urlKey: MailerURL.PUBLIC_WEB_URL,
            endpoint,
            token: activateToken,
        });

        await this.mailerService.sendEmail(subject, emailStructure);
    }

    async registerUnprivilegedUser(dto: RegUserUnprivileged, file?: Express.Multer.File) {
        try {
            return await this.dataSource.transaction(async(manager) => {
                const profile = await this.registerUser(dto, ProfileType.UNPRIVILEGED, file, false, manager);

                const { credId, plainToken: activationToken } = await this.credentialsService.createCredentials(
                    profile.profileId,
                    profile.email,
                    manager,
                );

                const hashedPassword = await this.credentialsService.hashPassword(dto.password.password);
                await this.credentialsService.activateCredentials(credId, hashedPassword, manager);

                await this.sendActivationEmail(profile, ProfileType.UNPRIVILEGED, activationToken);

                return profile;
            });

        } catch (error) {
            if (file) await fs.promises.unlink(file.path).catch(() => {});
            console.error("User-Service | Error: ", error);
            throw error;
        }
    }

    async registerPrivilegedUser(dto: RegUserPrivileged, file?: Express.Multer.File) {
        try {
            return await this.dataSource.transaction(async(manager) => {
                const profile = await this.registerUser(dto, ProfileType.PRIVILEGED, file, true, manager);

                const { plainToken: activationToken } = await this.credentialsService.createCredentials(
                    profile.profileId,
                    profile.email,
                    manager,
                );

                await this.sendActivationEmail(profile, ProfileType.PRIVILEGED, activationToken);

                return profile;
        });
        } catch (error) {
            if (file) await fs.promises.unlink(file.path).catch(() => {});
            console.error("User-Service | Error: ", error);
            throw error;
        }
    }

    async updateProfileData(
        profileId: number,
        updates: { name?: string; firstLastName?: string; secondLastName?: string },
        file: Express.Multer.File | undefined,
    )
        {
            try {
                return await this.dataSource.transaction(async (manager) => {
                    const repo = manager.getRepository(UserProfile);
                    const profile = await repo.findOne({ where: { profileId } });

                    if (!profile) {
                        throw new NotFoundException("User-Service | UPD-01: Profile not found.");
                    }

                    const previousPicture = profile.profilePicture;

                    await repo.update(profileId, {
                        ...(updates.name && { name: updates.name }),
                        ...(updates.firstLastName && { firstLastName: updates.firstLastName }),
                        ...(updates.secondLastName !== undefined && { secondLastName: updates.secondLastName }),
                        ...(file && { profilePicture: file.filename }),
                    });

                    if (file && previousPicture !== "default-profile-picture.png") {
                        await fs.promises.unlink(join("./profile-pictures", previousPicture)).catch(() => {});
                    }
                    
                    return repo.findOne({ where: { profileId } });
                });

            } catch (error) {
                if (file) await fs.promises.unlink(file.path).catch(() => {});
                console.error("User-Service | Error: ", error);
                throw error;
            }
        }

        private async startSensitiveOperation(
            credId: number,
            type: TokenType.PASSWORD_CHANGE | TokenType.EMAIL_CHANGE | TokenType.PHONE_CHANGE,
            mailer: { template: MailerTemplate; endpoint: MailerEndpoint; subject: MailerSubject },
            name: string,
            email: string,
            manager: EntityManager,
        )   {
                const { plainToken } = await this.tokenService.generateToken(
                    credId,
                    type,
                    "SENSITIVE_OPERATION_START_FLOW",
                    manager,
                );

                const emailStructure = this.mailerService.buildEmail(email, mailer.template, name, {
                    urlKey: MailerURL.PUBLIC_WEB_URL,
                    endpoint: mailer.endpoint,
                    token: plainToken
                });

                await this.mailerService.sendEmail(mailer.subject, emailStructure);

                return { operationToken: plainToken };
        }

        async initiatePasswordChange(credId: number, name: string, email: string) {
            return this.dataSource.transaction((manager) => 
                this.startSensitiveOperation(
                    credId,
                    TokenType.PASSWORD_CHANGE,
                    {
                        template: MailerTemplate.PASSWORD_CHANGE,
                        endpoint: MailerEndpoint.PASSWORD_CHANGE,
                        subject: MailerSubject.PASSWORD_CHANGE,
                    },
                    name,
                    email,
                    manager,
                )
            );
        }

        async initiateEmailChange(credId: number, name: string, email: string) {
            return this.dataSource.transaction((manager) =>
                this.startSensitiveOperation(
                    credId,
                    TokenType.EMAIL_CHANGE,
                    {
                        template: MailerTemplate.EMAIL_CHANGE,
                        endpoint: MailerEndpoint.EMAIL_CHANGE,
                        subject: MailerSubject.EMAIL_CHANGE,
                    },
                    name,
                    email,
                    manager,
                )
            );
        }

        async initiatePhoneChange(credId: number, name: string, email: string) {
            return this.dataSource.transaction((manager) =>
                this.startSensitiveOperation(
                    credId,
                    TokenType.PHONE_CHANGE,
                    {
                        template: MailerTemplate.PHONE_CHANGE,
                        endpoint: MailerEndpoint.PHONE_CHANGE,
                        subject: MailerSubject.PHONE_CHANGE,
                    },
                    name,
                    email,
                    manager,
                )
            );
        }

        async localLogOut(credId: number, userAgent: string) {
            return this.credentialsService.localLogOut(credId, userAgent);
        }

        async selectedLogOut(credId: number, userAgent: string) {
            return this.credentialsService.selectedLogOut(credId, userAgent);
        }

        async logOutAll(credId: number) {
            return this.credentialsService.logOutAll(credId);
        }
}

import { Injectable, ConflictException, BadRequestException, InternalServerErrorException, Inject } from "@nestjs/common";

import { DataSource, Repository, EntityManager } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";

import * as fs from "fs";

import { User } from "./entities/user-entity";
import { UserPhone } from "./entities/user-phone-entity";
import { UserProfile } from "./entities/user-profile-entity";

import { RegUser } from "./dtos/user-dtos";
import { ProfileType } from "./profile-type.enum";

@Injectable()
export class UserService {
    constructor(
        private readonly dataSource: DataSource,

        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(UserProfile)
        private readonly profileRepo: Repository<UserProfile>
    ) {}

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

    private async managePhone(phone: string, userId: string, manager: EntityManager) {
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
            throw new ConflictException("User-Service | VP-01: El TELÉFONO que quiere registrar ya está en uso.");
        }
    }

    private async addProfile(dto: RegUser, type: ProfileType, file: Express.Multer.File, manager: EntityManager) {
        if (type === "PRIVILEGED" && !file) {
            throw new BadRequestException("User-Service | AP-01: El registro de PERFILES PRIVILEGIADOS requiere, obligatoriamente, una foto de perfil.");
        }

        const repo = manager.getRepository(UserProfile);

        const profileExists = await repo.exists({
            where: {
                user: { userId: dto.user.userId },
                profileType: type
            }
        });

        if (profileExists) {
            throw new ConflictException("User-Service | AP-02: Ya existe una cuenta registrada con esta información. Por favor, inténtelo de nuevo.");
        }

        await this.managePhone(dto.profile.phone, dto.user.userId, manager);

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

    private async registerUser(dto: RegUser, type: ProfileType, file: Express.Multer.File, manager: EntityManager) {
        try {
            await this.addUser(dto.user.userId, manager);

            const profile = await this.addProfile(dto, type, file, manager);

            return profile;
        } catch (error) {
            if (file) {
                await fs.promises.unlink(file.path);
            }
            console.error("User-Service | Error: ", error);
            throw error;
        }
    }

    async registerUnprivilegedUser(dto: RegUser, file: Express.Multer.File) {
        try {
            await this.dataSource.transaction(async (manager) => {
                const profile = await this.registerUser(dto, ProfileType.UNPRIVILEGED, file, manager);

                // Incluir lógica referente a la creación de credenciales.
            });
        } catch (error) {
            console.error("User-Service | Error: ", error);
            throw error;
        }
    }

    async registerPrivilegedUser(dto: RegUser, file: Express.Multer.File) {
        try {
            await this.dataSource.transaction(async (manager) => {
                const profile = await this.registerUser(dto, ProfileType.PRIVILEGED, file, manager);

                // Incluir lógica referente a la creación de credenciales.
            });
        } catch (error) {
            console.error("User-Service | Error: ", error);
            throw error;
        }
    }
}

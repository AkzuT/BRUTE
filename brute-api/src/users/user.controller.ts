import { Controller, Post, UseInterceptors, BadRequestException, UploadedFile, Body, Patch, Get, Param } from "@nestjs/common";

import { Throttle } from "@nestjs/throttler";

import { FileInterceptor } from "@nestjs/platform-express";

import { IsPublic } from "src/authentication-guard/authentication-guard-decorators/public.decorator";
import { AllowedTokens } from "src/authentication-guard/authentication-guard-decorators/allowed-token.decorator";
import { AllowedRoles } from "src/roles-guard/roles-guard-decorators/allowed-roles.decorator";
import { CurrentUser } from "src/authentication-guard/authentication-guard-decorators/current-user.decorator";

import { ProfileType } from "./profile-type.enum";
import { TokenType } from "src/tokens/token-type.enum";

import type { AuthenticatedUser } from "src/authentication-guard/authentication-guard.interface";

import { UpdateEmailDTO, UpdatePhoneDTO, SelectedLogOutDTO } from "./dtos/user-dtos";
import { ReauthenticateDTO } from "src/credentials/dtos/credentials-dtos";

import { UserService } from "./user.service";
import { CredentialsService } from "src/credentials/credentials.service";

@Controller("users")
export class UserController {
    constructor (
        private readonly userService: UserService,
        private readonly credService: CredentialsService,
    ) {}

    @IsPublic()
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @Post("register")
    @UseInterceptors(FileInterceptor("picture", {
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.startsWith("image/")) {
                return cb(new BadRequestException("Only images allowed."), false);
            }
            cb(null, true);
        },
        limits: {fileSize: 5 * 1024 * 1024},
    }))
    async registerUser(
        @UploadedFile() file: Express.Multer.File,
        @Body("payload") payload: string,
    ) {
        const dto = JSON.parse(payload);

        return await this.userService.registerUnprivilegedUser(dto, file);
    }

    @AllowedTokens(TokenType.SESSION)
    @AllowedRoles(ProfileType.PRIVILEGED)
    @Post("register-privileged")
    @UseInterceptors(FileInterceptor("picture", {
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.startsWith("image/")) {
                return cb(new BadRequestException("Only images allowed."), false);
            }
            cb(null, true);
        },
        limits: {fileSize: 5 * 1024 * 1024},
    }))
    async registerPrivilegedUser(
        @UploadedFile() file: Express.Multer.File,
        @Body("payload") payload: string
    ) {
        const dto = JSON.parse(payload);

        return await this.userService.registerPrivilegedUser(dto, file);
    }

    @AllowedTokens(TokenType.SESSION)
    @Get("me")
    async getUser(
        @CurrentUser() user: AuthenticatedUser
    ) {
        return user.profile;
    }

    @AllowedTokens(TokenType.SESSION)
    @Patch("update-profile")
    @UseInterceptors(FileInterceptor("picture", {
        fileFilter: (req, file, cb) => {
            if (!file.mimetype.startsWith("image/")) {
                return cb(new BadRequestException("Only images allowed."), false);
            }
            cb(null, true);
        },
        limits: {fileSize: 5 * 1024 * 1024},
    }))
    async updateProfile(
        @CurrentUser() user: AuthenticatedUser,
        @UploadedFile() file: Express.Multer.File,
        @Body("payload") payload: string
    ) {
        const dto = JSON.parse(payload);
        
        return await this.userService.updateProfile(user.profile.profileId, dto, file);
    }

    @AllowedTokens(TokenType.SESSION)
    @Post("change-password")
    async initiatePasswordChange(
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return await this.userService.initiatePasswordChange(
            user.profile.name,
            user.profile.email,
            user.credential.credId
        );
    }

    @AllowedTokens(TokenType.SESSION)
    @Post("change-email")
    async initiateEmailChange(
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return await this.userService.initiateEmailChange(
            user.profile.name,
            user.profile.email,
            user.credential.credId
        );
    }

    @AllowedTokens(TokenType.EMAIL_CHANGE)
    @Post("request-email-change")
    async requestEmailChange(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: UpdateEmailDTO,
    ) {
        await this.credService.credReauthentication(
            user.credential,
            user.token.tokenId,
            dto.credentials.password,
            dto.credentials.otp
        );

        return await this.userService.requestEmailChange(
            user.profile.name,
            dto.newEmail,
            user.credential.credId,
            user.token.tokenId
        );
    }

    @AllowedTokens(TokenType.EMAIL_CHANGE)
    @Post("confirm-email-change/:sig")
    async confirmEmailChange(
        @CurrentUser() user: AuthenticatedUser,
        @Param("sig") sig: string,
        @Body() dto: UpdateEmailDTO
    ) {
        await this.credService.credReauthentication(
            user.credential,
            user.token.tokenId,
            dto.credentials.password,
            dto.credentials.otp
        );

        return await this.userService.confirmEmailChange(
            user.profile.profileId,
            user.profile.name,
            user.profile.email,
            dto.newEmail,
            user.credential.credId,
            sig
        );
    }

    @AllowedTokens(TokenType.SESSION)
    @Post("change-phone")
    async initiatePhoneChange(
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return await this.userService.initiatePhoneChange(user.profile.name, user.profile.email, user.credential.credId);
    }

    @AllowedTokens(TokenType.PHONE_CHANGE)
    @Post("confirm-phone-change")
    async updatePhone(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: UpdatePhoneDTO
    ) {
        await this.credService.credReauthentication(
            user.credential,
            user.token.tokenId,
            dto.credentials.password,
            dto.credentials.otp
        );

        return await this.userService.updatePhone(
            user.profile.user.userId,
            user.profile.profileId,
            user.profile.name,
            user.profile.email,
            dto.newPhone,
            user.credential.credId,
            user.token.tokenId
        );
    }

    @AllowedTokens(TokenType.SESSION)
    @Post("log-out")
    async localLogOut(
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return await this.userService.localLogOut(user.credential.credId, user.token.userAgent);
    }

    @AllowedTokens(TokenType.SESSION)
    @Post("selected-log-out")
    async selectedLogOut(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: SelectedLogOutDTO
    ) {
        await this.credService.credReauthentication(
            user.credential,
            user.token.tokenId,
            dto.credentials.password,
            dto.credentials.otp
        );
        
        return await this.userService.selectedLogOut(user.credential.credId, dto.userAgent.userAgent);
    }

    @AllowedTokens(TokenType.SESSION)
    @Post("log-out-all")
    async logOutAll(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: ReauthenticateDTO
    ) {
        await this.credService.credReauthentication(
            user.credential,
            user.token.tokenId,
            dto.password, 
            dto.otp
        );
        
        return await this.userService.logOutAll(user.credential.credId);
    }
}

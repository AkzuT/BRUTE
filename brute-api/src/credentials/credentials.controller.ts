import { Controller, Post, Body, Res } from "@nestjs/common";

import { Throttle } from "@nestjs/throttler";

import type { Response } from "express";

import { IsPublic } from "src/authentication-guard/authentication-guard-decorators/public.decorator";
import { AllowedTokens } from "src/authentication-guard/authentication-guard-decorators/allowed-token.decorator";
import { AllowedRoles } from "src/roles-guard/roles-guard-decorators/allowed-roles.decorator";
import { CurrentUser } from "src/authentication-guard/authentication-guard-decorators/current-user.decorator";

import { ProfileType } from "src/users/profile-type.enum";
import { TokenType } from "src/tokens/token-type.enum";
import { FIXED_TOKEN_DURATIONS_MS, REFRESH_DURATION_MS } from "src/tokens/token-duration";

import type { AuthenticatedUser } from "src/authentication-guard/authentication-guard.interface";

import {
    IdentifierDTO,
    MFAEnrollmentDTO,
    CredAuthDTO,
    MFAAuthDTO,
    InitiatePasswordResetDTO,
    PasswordResetDTO,
    PasswordChangeDTO,
    ReactivationDTO
} from "./dtos/credentials-dtos";

import { CredentialsService } from "./credentials.service";

@Controller("credentials")
export class CredentialsController {
    constructor (
        private readonly credService: CredentialsService
    ) {}

    @AllowedTokens(TokenType.ACTIVATION, TokenType.MFA_RESET)
    @Post("sentinel")
    async sentinel(
        @CurrentUser() user: AuthenticatedUser
    ) {
        return await this.credService.sentinel(
            user.profile.profileType,
            user.profile.email,
            user.credential
        );
    }

    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @AllowedTokens(TokenType.ACTIVATION)
    @Post("mfa-enrollment")
    async mfaEnrollment(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: MFAEnrollmentDTO
    ) {
        return await this.credService.mfaEnrollment(dto, user.credential, user.token.tokenId);
    }

    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @IsPublic()
    @Post("cred-auth")
    async credAuth(
        @Body() dto: CredAuthDTO,
        @Res({ passthrough: true }) res: Response
    ) {
        const { plainToken } = await this.credService.credAuthentication(dto);

        res.cookie("brute-pat", plainToken, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: FIXED_TOKEN_DURATIONS_MS.PRE_AUTH,
            path: "/"
        });
    }

    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @AllowedTokens(TokenType.PRE_AUTH)
    @Post("mfa-auth")
    async mfaAuth(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: MFAAuthDTO,
        @Res({ passthrough: true }) res: Response
    ) {
        const { refreshToken, rememberMe, sessionToken } = await this.credService.mfaAuthentication(
            dto,
            user.profile.name,
            user.profile.email,
            user.credential, user.token.tokenId
        );

        res.cookie("brute-rt", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: rememberMe ? REFRESH_DURATION_MS.REMEMBER_ME : REFRESH_DURATION_MS.DEFAULT,
            path: "/"
        });

        res.cookie("brute-st", sessionToken, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: FIXED_TOKEN_DURATIONS_MS.SESSION,
            path: "/"
        });
    }

    @Throttle({ default: { ttl: 60000, limit: 5 } })
    @IsPublic()
    @Post("reset-password")
    async initiatePasswordReset(
        @Body() dto: InitiatePasswordResetDTO
    ) {
        return await this.credService.initiatePasswordReset(dto.identifier, dto.userAgent);
    }

    @AllowedTokens(TokenType.PASSWORD_RESET)
    @Post("confirm-password-reset")
    async resetPassword(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: PasswordResetDTO
    ) {        
        await this.credService.otpReauthentication(
            user.credential,
            user.token.tokenId,
            dto.otp
        );
        
        return await this.credService.resetPassword(
            dto,
            user.profile.name,
            user.profile.email,
            user.credential.credId,
            user.token.tokenId
        );
    }

    @AllowedTokens(TokenType.PASSWORD_CHANGE)
    @Post("confirm-password-change")
    async updatePassword(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: PasswordChangeDTO
    ) {
        await this.credService.credReauthentication(
            user.credential,
            user.token.tokenId,
            dto.credentials.password,
            dto.credentials.otp
        );
        
        return this.credService.updatePassword(
            dto,
            user.profile.name,
            user.profile.email,
            user.credential.credId,
            user.token.tokenId
        );
    }

    @AllowedTokens(TokenType.SESSION)
    @AllowedRoles(ProfileType.PRIVILEGED)
    @Post("unlock-credentials")
    async unlockCredentials(
        @Body() dto: IdentifierDTO
    ) {
        return await this.credService.unlockCredentials(dto.identifier);
    }

    @AllowedTokens(TokenType.FRAUD_FLAG)
    @Post("fraud-flag")
    async handleCompromisedCredentials(
        @CurrentUser() user: AuthenticatedUser
    ) {
        return await this.credService.handleCompromisedCredentials(
            user.profile.name,
            user.profile.email,
            user.credential.credId
        );
    }

    @AllowedTokens(TokenType.SESSION)
    @AllowedRoles(ProfileType.PRIVILEGED)
    @Post("start-credentials-reactivation")
    async startCredReactivation(
        @Body() dto: IdentifierDTO
    ) {
        return await this.credService.startCredReactivation(dto.identifier);
    }

    @AllowedTokens(TokenType.REACTIVATION)
    @Post("reactivate-credentials")
    async reactivateCredentials(
        @CurrentUser() user: AuthenticatedUser,
        @Body() dto: ReactivationDTO
    ) {
        return await this.credService.reactivateCredentials(
            dto,
            user.credential.credId,
            user.token.tokenId
        );
    }
}

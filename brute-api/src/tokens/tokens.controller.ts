import { Controller, Post, Res } from "@nestjs/common";

import type { Response } from "express";

import { AllowedTokens } from "src/authentication-guard/authentication-guard-decorators/allowed-token.decorator";
import { CurrentUser } from "src/authentication-guard/authentication-guard-decorators/current-user.decorator";

import { TokenType } from "./token-type.enum";
import { FIXED_TOKEN_DURATIONS_MS } from "./token-duration";

import type { AuthenticatedUser } from "src/authentication-guard/authentication-guard.interface";

import { TokenService } from "./tokens.service";

@Controller("tokens")
export class TokensController {
    constructor (
        private readonly tokenService: TokenService
    ) {}

    @AllowedTokens(TokenType.REFRESH)
    @Post("refresh-session")
    async refreshSession(
        @CurrentUser() user: AuthenticatedUser,
        @Res({ passthrough: true }) res: Response
    ) {
        const { plainToken } = await this.tokenService.refreshSession(user.credential.credId, user.token.userAgent);

        res.cookie("brute-st", plainToken, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: FIXED_TOKEN_DURATIONS_MS.SESSION,
            path: "/"
        });
    }
}

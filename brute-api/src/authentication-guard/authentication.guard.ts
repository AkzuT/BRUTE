import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";

import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { TokenType } from "src/tokens/token-type.enum";

import { AuthenticationGuardService } from "./authentication-guard.service";

@Injectable()
export class AuthenticationGuard implements CanActivate {
    constructor (
        private readonly authGuardService: AuthenticationGuardService,
        private readonly reflector: Reflector
    ) {}

    private isPublic(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>("isPublic", [
            context.getHandler(),
            context.getClass(),
        ]);
    }

    private getAllowedTokens(context: ExecutionContext): TokenType[] {
        return this.reflector.getAllAndOverride<TokenType[]>("allowedTokens", [
            context.getHandler(),
            context.getClass(),
        ]);
    }

    private extractToken(request: Request, allowedTokens: TokenType[]): string | undefined {
        const cookieMap: Partial<Record<TokenType, string>> = {
            [TokenType.PRE_AUTH]: "brute_pat",
            [TokenType.REFRESH]: "brute_rt",
            [TokenType.SESSION]: "brute_st"
        };

        const primaryToken = allowedTokens?.[0];

        if (primaryToken && cookieMap[primaryToken]) {
            return request.cookies[cookieMap[primaryToken]];
        }

        return (request.query["token"] as string) ?? request.params["token"];
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublic(context)) return true;

        const request = context.switchToHttp().getRequest();

        const allowedToken = this.getAllowedTokens(context);
        
        const rawToken = this.extractToken(request, allowedToken);

        if (!rawToken) {
            throw new UnauthorizedException("Authentication Guard | E01: Invalid request.");
        }

        const user = await this.authGuardService.validateToken(rawToken);

        if (allowedToken && !allowedToken.includes(user.token.tokenType)) {
            throw new UnauthorizedException("Authentication Guard | E02: Invalid request.");
        }

        request["user"] = user;

        return true;
    }
}
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { EntityManager, In } from "typeorm";
import { randomBytes, createHash } from "crypto";

import { Token } from "./entities/token-entity";
import { TokenType } from "./token-type.enum";
import { FIXED_TOKEN_DURATIONS_MS, REFRESH_DURATION_MS } from "./token-duration";

@Injectable()
export class TokenService {
    private resolveExpiresAt(tokenType: TokenType, rememberMe: boolean | undefined): Date {
        const now = Date.now();

        if (tokenType === TokenType.REFRESH) {
            const durationMS = rememberMe ? REFRESH_DURATION_MS.REMEMBER_ME : REFRESH_DURATION_MS.DEFAULT;
            
            return new Date(now + durationMS);
        }

        const fixedDuration = FIXED_TOKEN_DURATIONS_MS[tokenType]!;
        
        return new Date(now + fixedDuration);
    }

    private async generateUniqueTokenHash(manager: EntityManager): Promise<{ plainToken: string; tokenHash: string }> {
        const repo = manager.getRepository(Token);

        while (true) {
            const plainToken = randomBytes(32).toString("hex");
            const tokenHash = createHash("sha256").update(plainToken).digest("hex");

            const tokenReference = await repo.exists({
                where: {
                    tokenHash: tokenHash
                }
            });

            if (!tokenReference) {
                return { plainToken, tokenHash };
            }
        }
    }

    async generateToken(
        credId: number,
        tokenType: TokenType,
        userAgent: string,
        manager: EntityManager,
        options?: {rememberMe?: boolean; },
    ): Promise<{ tokenId: number; plainToken: string }> {
        const repo = manager.getRepository(Token);
        
        const expiresAt = this.resolveExpiresAt(tokenType, options?.rememberMe);

        const { plainToken, tokenHash } = await this.generateUniqueTokenHash(manager);

        const newToken = repo.create({
            credential: { credId: credId },
            tokenType: tokenType,
            tokenHash: tokenHash,
            expiresAt: expiresAt,
            userAgent: userAgent,
        });

        const token = await repo.save(newToken);

        return { tokenId: token.tokenId, plainToken };   
    }

    async generateSessionTokens(
        credId: number,
        userAgent: string,
        manager: EntityManager,
        options: { rememberMe?: boolean },
    ): Promise <{ refreshToken: string; sessionToken: string; }> {
        const { plainToken: refreshToken } = await this.generateToken(
            credId,
            TokenType.REFRESH,
            userAgent,
            manager,
            { rememberMe: options.rememberMe },
        );

        const { plainToken: sessionToken } = await this.generateToken(
            credId,
            TokenType.SESSION,
            userAgent,
            manager,
        );

        return { refreshToken, sessionToken };
    }

    async validateToken(tokenType: TokenType, plainToken: string, manager: EntityManager): Promise<Token> {
        const repo = manager.getRepository(Token);

        const tokenHash = createHash("sha256").update(plainToken).digest("hex");

        const tokenReference = await repo.findOne({ 
            where: {
                tokenType: tokenType,
                tokenHash: tokenHash
            },
            relations: ["credential", "credential.profile"],
         });

        if (!tokenReference) {
            throw new UnauthorizedException("Authentication Guard | VT-01: Invalid operation.");
        }

        if (tokenReference.revoked) {
            throw new UnauthorizedException("Authentication Guard | VT-02: Invalid operation.");
        }

        if (tokenReference.expiresAt.getTime() < Date.now()) {
            throw new UnauthorizedException("Authentication Guard | VT-03: Invalid operation.");
        }

        return tokenReference;
    }

    async revokeToken(tokenId: number, manager: EntityManager): Promise<void> {
        const repo = manager.getRepository(Token);

        await repo.update(tokenId, {
            revoked: true
        });
    }

    async revokeAllForCredentials(credId: number, manager: EntityManager): Promise<void> {
        const repo = manager.getRepository(Token);

        await repo.update(
            { 
                credential: { credId: credId } 
            },
            {
                revoked: true
            }
        );
    }
    
    async revokeAllForCredentialsByType(credId: number, tokenType: TokenType, manager: EntityManager): Promise<void> {
        const repo = manager.getRepository(Token);

        await repo.update(
            {
                credential: { credId: credId },
                tokenType: tokenType
            },
            {
                revoked: true
            }
        );
    }

    async hasLoggedInFromDevice(credId: number, userAgent: string, manager: EntityManager): Promise<boolean> {
        const repo = manager.getRepository(Token);

        return repo.exists({
            where: {
                credential: { credId: credId },
                tokenType: In([TokenType.SESSION, TokenType.REFRESH]),
                userAgent: userAgent
            }
        });
    }
}
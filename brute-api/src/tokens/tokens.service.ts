import { Injectable, UnauthorizedException } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { randomBytes, createHash } from "crypto";

import { Token } from "./entities/token-entity"
import { TokenType } from "./token-type.enum"
import {
    FIXED_TOKEN_DURATIONS_MS,
    REFRESH_DURATION_MS,
    MFA_RESET_DEFAULT_DURATION_MS,
} from "./token-duration"

@Injectable()
export class TokenService {
    private resolveExpiresAt(
        type: TokenType,
        rememberMe: boolean | undefined,
        inheritedExpiresAt: Date | undefined,
    ): Date {
        const now = Date.now();

        if (type === TokenType.REFRESH) {
            const durationMS = rememberMe
            ? REFRESH_DURATION_MS.REMEMBER_ME
            : REFRESH_DURATION_MS.DEFAULT;
            return new Date(now + durationMS);
        }

        if (type === TokenType.MFA_RESET) {
            return inheritedExpiresAt ?? new Date(now + MFA_RESET_DEFAULT_DURATION_MS);
        }

        const fixedDuration = FIXED_TOKEN_DURATIONS_MS[type]!;
        return new Date(now + fixedDuration);
    }

    private async generateUniqueTokenHash(
        manager: EntityManager,
    ): Promise<{ plainToken: string; tokenHash: string }> {
        const repo = manager.getRepository(Token);

        while (true) {
            const plainToken = randomBytes(32).toString("hex");
            const tokenHash = createHash("sha256").update(plainToken).digest("hex");

            const exists = await repo.exists({ where: { tokenHash } });
            if (!exists) {
                return { plainToken, tokenHash };
            }
        }
    }

    async generateToken(
        credId: number,
        type: TokenType,
        manager: EntityManager,
        options?: {userAgent?: string; rememberMe?: boolean; inheritedExpiresAt?: Date },
        ): Promise<{ plainToken: string; tokenId: number }> {
            const expiresAt = this.resolveExpiresAt(
                type,
                options?.rememberMe,
                options?.inheritedExpiresAt,
            );
            const { plainToken, tokenHash } = await this.generateUniqueTokenHash(manager);

            const repo = manager.getRepository(Token);
            const token = repo.create({
                credId,
                tokenType: type,
                tokenHash,
                expiresAt,
                userAgent: options?.userAgent ?? "unknown",
            });

            const saved = await repo.save(token);

            return { plainToken, tokenId: saved.tokenId };   
        }

    async validateToken(
        plainToken: string,
        type: TokenType,
        manager: EntityManager,
    ): Promise<Token> {
        const tokenHash = createHash("sha256").update(plainToken).digest("hex");
        const repo = manager.getRepository(Token);

        const token = await repo.findOne({ 
            where: { tokenHash, tokenType: type },
            relations: ["credential", "credential.profile"],
         });

        if (!token) {
            throw new UnauthorizedException("Authentication Guard | VT-01: Invalid operation.");
        }

        if (token.revoked) {
            throw new UnauthorizedException("Authentication Guard | VT-02: Invalid operation.");
        }

        if (token.expiresAt.getTime() < Date.now()) {
            throw new UnauthorizedException("Authentication Guard | VT-03: Invalid operation.");
        }

        return token;
    }

    async revokeToken(tokenId: number, manager: EntityManager): Promise<void> {
        const repo = manager.getRepository(Token);
        await repo.update({ tokenId }, { revoked: true });
    }

    async revokeAllForCredential(credId: number, manager: EntityManager): Promise<void> {
        const repo = manager.getRepository(Token);
        await repo.update({ credId }, { revoked: true });
    }   
}
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import * as crypto from "crypto";

import { Token } from "src/tokens/entities/token-entity";

@Injectable()
export class AuthenticationGuardService {
    constructor(
        @InjectRepository(Token)
        private readonly tokenRepo: Repository<Token>
    ) {}

    async validateToken(rawToken: string) {
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        const tokenReference = await this.tokenRepo.findOne({
            where: {
                tokenHash: hashedToken,
                revoked: false,
            },
            relations: [
                "credential",
                "credential.profile"
            ]
        });

        if (!tokenReference) {
            throw new UnauthorizedException("Authentication Guard | VT-01: Invalid request.");
        }

        if (tokenReference.expiresAt < new Date()) {
            throw new UnauthorizedException("Authentication Guard | VT-02: Invalid request");
        }

        return {
            profile: tokenReference.credential.profile,
            credential: tokenReference.credential,
            token: tokenReference
        };
    }
}

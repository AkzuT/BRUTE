import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";

import { Reflector } from "@nestjs/core";

import { ProfileType } from "src/users/profile-type.enum";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const allowedRoles = this.reflector.getAllAndOverride<ProfileType[]>("allowedRoles", [
            context.getHandler(),
            context.getClass()
        ]);

        if (!allowedRoles) return true;

        const { profile } = context.switchToHttp().getRequest()["user"];

        if (!allowedRoles.includes(profile.profileType)) {
            throw new ForbiddenException("Roles Guard | E01: Insufficient permissions.");
        }

        return true;
    }
}
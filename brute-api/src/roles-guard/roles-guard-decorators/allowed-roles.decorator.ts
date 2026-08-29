import { SetMetadata } from "@nestjs/common";

import { ProfileType } from "src/users/profile-type.enum";

export const AllowedRoles = (...roles: ProfileType[]) => SetMetadata("allowedRoles", roles);
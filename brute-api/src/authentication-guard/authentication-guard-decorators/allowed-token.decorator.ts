import { SetMetadata } from "@nestjs/common";

import { TokenType } from "src/tokens/token-type.enum";

export const AllowedToken = (token: TokenType) => SetMetadata("allowedToken", token);
import { SetMetadata } from "@nestjs/common";

import { TokenType } from "src/tokens/token-type.enum";

export const AllowedTokens = (...tokens: TokenType[]) => SetMetadata("allowedTokens", tokens);

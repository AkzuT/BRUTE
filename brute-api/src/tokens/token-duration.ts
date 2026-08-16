import { TokenType } from "./token-type.enum";

export const FIXED_TOKEN_DURATIONS_MS: Partial<Record<TokenType, number>> = {
    [TokenType.ACTIVATION]: 24 * 60 * 60 * 1000,
    [TokenType.PASSWORD_RESET]: 1 * 60 * 60 * 1000,
    [TokenType.PRE_AUTH]: 2 * 60 * 1000,
    [TokenType.SESSION]: 15 * 60 * 1000,
    [TokenType.PASSWORD_CHANGE]: 1 * 60 * 60 * 1000,
    [TokenType.EMAIL_CHANGE]: 12 * 60 * 60 * 1000,
    [TokenType.MFA_RESET]: 15 * 60 * 1000,
    [TokenType.PHONE_CHANGE]: 12 * 60 * 60 * 1000,
    [TokenType.FRAUD_FLAG]: 2 * 60 * 60 * 1000,
    [TokenType.REACTIVATION]: 24 * 60 * 60 * 1000,
};

export const REFRESH_DURATION_MS = {
    DEFAULT: 48 * 60 * 60 * 1000,
    REMEMBER_ME: 6 * 30 * 24 * 60 * 60 * 1000,
};

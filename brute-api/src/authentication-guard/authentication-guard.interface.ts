import { UserProfile } from "src/users/entities/user-profile-entity"
import { Credential } from "src/credentials/entities/credentials-entity"
import { Token } from "src/tokens/entities/token-entity"

interface AuthenticatedUser {
    profile: UserProfile;
    credential: Credential;
    token: Token;
}

export type {
    AuthenticatedUser
}
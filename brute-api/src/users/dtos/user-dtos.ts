import { IsNotEmpty, IsString, Length, MaxLength, IsOptional, IsEmail } from "class-validator";

import { ValidateNested } from "class-validator";
import { Type } from "class-transformer";

import { PasswordDTO, ReauthenticateDTO, UserAgentDTO } from "src/credentials/dtos/credentials-dtos";

class UserDTO {
    @IsNotEmpty()
    @IsString()
    @Length(9)
    userId!: string;
}

class UserProfileDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    name!: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    firstLastName!: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    secondLastName!: string;

    @IsNotEmpty()
    @IsEmail()
    @MaxLength(255)
    email!: string;

    @IsNotEmpty()
    @IsString()
    @Length(8)
    phone!: string;
}

class UpdateProfileDTO {
    @IsOptional()
    @IsString()
    @MaxLength(50)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    firstLastName!: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    secondLastName!: string;
}

class UpdateEmailDTO {
    @ValidateNested()
    @Type(() => ReauthenticateDTO)
    credentials!: ReauthenticateDTO;
    
    @IsNotEmpty()
    @IsEmail()
    @MaxLength(255)
    newEmail!: string;
}

class UpdatePhoneDTO {
    @ValidateNested()
    @Type(() => ReauthenticateDTO)
    credentials!: ReauthenticateDTO;
    
    @IsNotEmpty()
    @IsString()
    @Length(8)
    newPhone!: string;
}

class SelectedLogOutDTO {
    @ValidateNested()
    @Type(() => ReauthenticateDTO)
    credentials!: ReauthenticateDTO;

    @ValidateNested()
    @Type(() => UserAgentDTO)
    userAgent!: UserAgentDTO;
}

type RegUserUnprivileged = {
    user: UserDTO,
    profile: UserProfileDTO
    password: PasswordDTO
}

type RegUserPrivileged = {
    user: UserDTO,
    profile: UserProfileDTO
}

export type { 
    RegUserUnprivileged,
    RegUserPrivileged
}

export {
    UpdateProfileDTO,
    UpdateEmailDTO,
    UpdatePhoneDTO,
    SelectedLogOutDTO,
}
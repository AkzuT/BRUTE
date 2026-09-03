import { IsNotEmpty, IsString, MinLength, MaxLength, IsNumberString, Length, IsBoolean  } from "class-validator";

import { ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class IdentifierDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    identifier!: string;
}

class PasswordDTO {
    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    password!: string;
}

class UserAgentDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    userAgent!: string;
}

class PrivilegedActivationDTO {
    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    password!: string;
}

class MFAEnrollmentDTO {
    @IsNotEmpty()
    @IsNumberString()
    @Length(6, 6)
    otp!: string;
}

class CredAuthDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    identifier!: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    password!: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    userAgent!: string;
}

class MFAAuthDTO {
    @IsNotEmpty()
    @IsNumberString()
    @Length(6, 6)
    otp!: string;

    @IsNotEmpty()
    @IsBoolean()
    rememberMe!: boolean;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    userAgent!: string;
}

class ReauthenticateDTO {
    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    password!: string;

    @IsNotEmpty()
    @IsNumberString()
    @Length(6, 6)
    otp!: string;
}

class InitiatePasswordResetDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    identifier!: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    userAgent!: string;
}

class PasswordResetDTO {
    @IsNotEmpty()
    @IsNumberString()
    @Length(6, 6)
    otp!: string;
    
    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    newPassword!: string;
}

class PasswordChangeDTO {
    @ValidateNested()
    @Type(() => ReauthenticateDTO)
    credentials!: ReauthenticateDTO;

    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    newPassword!: string;
}

class ReactivationDTO {
    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    newPassword!: string;
}

export {
    IdentifierDTO,
    PasswordDTO,
    UserAgentDTO,
    PrivilegedActivationDTO,
    MFAEnrollmentDTO,
    CredAuthDTO,
    MFAAuthDTO,
    ReauthenticateDTO,
    InitiatePasswordResetDTO,
    PasswordResetDTO,
    PasswordChangeDTO,
    ReactivationDTO
}
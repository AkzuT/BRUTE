import { IsNotEmpty, IsString, MinLength, MaxLength, IsNumberString, Length, IsBoolean  } from "class-validator";
import { ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class PrivilegedActivationDTO {
    @IsNotEmpty()
    @IsString()
    token!: string;

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

class ResetPasswordDTO {
    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    newPassword!: string;
}

class ChangePasswordDTO {
    @ValidateNested()
    @Type(() => CredAuthDTO)
    credentials!: CredAuthDTO;

    @ValidateNested()
    @Type(() => MFAAuthDTO)
    mfaData!: MFAAuthDTO;

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
    PrivilegedActivationDTO,
    MFAEnrollmentDTO,
    CredAuthDTO,
    MFAAuthDTO,
    ResetPasswordDTO,
    ChangePasswordDTO,
    ReactivationDTO
}
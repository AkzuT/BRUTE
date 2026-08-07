import { IsNotEmpty, IsString, MinLength, MaxLength, IsNumberString, Length  } from "class-validator";
import { ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class PrivilegedActivationDTO {
    @IsNotEmpty()
    @IsString()
    token: string = "";

    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    password: string = "";
}

class MFAEnrollmentDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    identifier: string = "";

    @IsNotEmpty()
    @IsNumberString()
    @Length(6, 6)
    otp: string = "";
}

class CredAuthDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    identifier: string = "";

    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    password: string = "";
}

class MFAuthDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    identifier: string = "";

    @IsNotEmpty()
    @IsNumberString()
    @Length(6, 6)
    otp: string = "";

    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    userAgent: string = "";
}

class ResetPasswordDTO {
    @ValidateNested()
    @Type(() => MFAuthDTO)
    mfaData!: MFAuthDTO;

    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    newPassword: string = "";
}

class ChangePasswordDTO {
    @ValidateNested()
    @Type(() => CredAuthDTO)
    credentials!: CredAuthDTO;

    @ValidateNested()
    @Type(() => MFAuthDTO)
    mfaData!: MFAuthDTO;

    @IsNotEmpty()
    @IsString()
    @MinLength(12)
    @MaxLength(20)
    newPassword: string = "";
}

export {
    PrivilegedActivationDTO,
    MFAEnrollmentDTO,
    CredAuthDTO,
    MFAuthDTO,
    ResetPasswordDTO,
    ChangePasswordDTO
}
import { IsNotEmpty, IsString, Length, MaxLength, IsOptional, IsEmail } from "class-validator";

export class UserDTO {
    @IsNotEmpty()
    @IsString()
    @Length(9)
    userId: string = "";
}

export class UserProfileDTO {
    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    name: string = "";

    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    firstLastName: string = "";

    @IsOptional()
    @IsString()
    @MaxLength(50)
    secondLastName: string = "";

    @IsNotEmpty()
    @IsEmail()
    @MaxLength(255)
    email: string = "";

    @IsNotEmpty()
    @IsString()
    @Length(8)
    phone: string = "";
}

type RegUser = {
    user: UserDTO,
    profile: UserProfileDTO
}

export type { 
    RegUser,
}
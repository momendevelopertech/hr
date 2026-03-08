import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;
}

export class ChangePasswordDto {
    @IsString()
    @MinLength(8)
    currentPassword: string;

    @IsString()
    @MinLength(8)
    newPassword: string;
}

export class ResetPasswordRequestDto {
    @IsEmail()
    email: string;
}

export class ResetPasswordDto {
    @IsString()
    token: string;

    @IsString()
    @MinLength(8)
    newPassword: string;
}

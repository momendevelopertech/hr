import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @IsString()
    identifier: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsBoolean()
    rememberMe?: boolean;
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

    @IsOptional()
    @IsString()
    locale?: string;
}

export class ResetPasswordDto {
    @IsString()
    token: string;

    @IsString()
    @MinLength(8)
    newPassword: string;
}

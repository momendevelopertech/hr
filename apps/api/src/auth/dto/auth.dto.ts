import { Type } from 'class-transformer';
import { WorkflowMode } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

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

export class RegisterDto {
    @IsString()
    @MinLength(3)
    fullName: string;

    @IsOptional()
    @IsString()
    fullNameAr?: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsString()
    @MinLength(8)
    password: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    branchId: number;

    @IsString()
    @MinLength(1)
    departmentId: string;

    @IsString()
    @MinLength(2)
    jobTitle: string;

    @IsOptional()
    @IsString()
    jobTitleAr?: string;
}

export class UpdateWorkflowModeDto {
    @IsEnum(WorkflowMode)
    workflowMode: WorkflowMode;
}

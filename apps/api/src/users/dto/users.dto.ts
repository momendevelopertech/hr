import { Type, Transform } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEmail,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
    MinLength,
} from 'class-validator';
import { Governorate, Role, LeaveType, NotificationDeliveryPreference } from '@prisma/client';
import { DateRangeQueryDto } from '../../shared/dto/date-range.dto';

export class CreateUserDto {
    @IsString()
    employeeNumber: string;

    @IsString()
    fullName: string;

    @IsOptional()
    @IsString()
    fullNameAr?: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @IsOptional()
    @IsEnum(Governorate)
    governorate?: Governorate;

    @Transform(({ value }) => (value === '' || value === null ? undefined : value))
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branchId?: number;

    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsString()
    departmentId?: string;

    @IsString()
    @IsNotEmpty()
    jobTitle?: string;

    @IsOptional()
    @IsString()
    jobTitleAr?: string;

    @IsOptional()
    @IsString()
    fingerprintId?: string;
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsString()
    fullNameAr?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @IsOptional()
    @IsEnum(Governorate)
    governorate?: Governorate | null;

    @IsOptional()
    @Transform(({ value }) => (value === '' || value === null ? undefined : value))
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branchId?: number | null;

    @IsOptional()
    @Transform(({ value }) => (value === '' ? undefined : value))
    @IsString()
    departmentId?: string | null;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    jobTitle?: string;

    @IsOptional()
    @IsString()
    jobTitleAr?: string;

    @IsOptional()
    @IsString()
    fingerprintId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    profileImage?: string;
}

export class UpdateOwnProfileDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsString()
    fullNameAr?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEnum(NotificationDeliveryPreference)
    notificationDeliveryPreference?: NotificationDeliveryPreference;
}

export class UpdateUserPasswordDto {
    @IsString()
    @MinLength(8)
    newPassword: string;
}

export class UpdateLeaveBalanceDto {
    @IsEnum(LeaveType)
    leaveType: LeaveType;

    @Type(() => Number)
    @IsInt()
    @Min(2000)
    @Max(2100)
    year: number;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    totalDays: number;
}

export class UsersQueryDto extends DateRangeQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @IsOptional()
    @IsString()
    departmentId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    branchId?: number;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(Governorate)
    governorate?: Governorate;
}

export class UserHistoryQueryDto extends DateRangeQueryDto {
    @IsOptional()
    @Transform(({ value }) => value === '1' || value === 'true' || value === true)
    @IsBoolean()
    includeDetails?: boolean;
}

import { Type } from 'class-transformer';
import {
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Min,
    IsDateString,
    Matches,
} from 'class-validator';
import { PermissionType } from '@prisma/client';

export class CreatePermissionDto {
    @IsOptional()
    @IsString()
    userId?: string;

    @IsEnum(PermissionType)
    permissionType: PermissionType;

    @IsDateString()
    requestDate: string;

    @IsOptional()
    @Matches(/^\d{2}:\d{2}$/)
    arrivalTime?: string;

    @IsOptional()
    @Matches(/^\d{2}:\d{2}$/)
    leaveTime?: string;

    @IsOptional()
    @IsIn(['ARRIVAL', 'DEPARTURE'])
    permissionScope?: 'ARRIVAL' | 'DEPARTURE';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    durationMinutes?: number;

    @IsOptional()
    @IsString()
    reason?: string;
}

export class UpdatePermissionDto {
    @IsOptional()
    @IsEnum(PermissionType)
    permissionType?: PermissionType;

    @IsOptional()
    @IsDateString()
    requestDate?: string;

    @IsOptional()
    @Matches(/^\d{2}:\d{2}$/)
    arrivalTime?: string;

    @IsOptional()
    @Matches(/^\d{2}:\d{2}$/)
    leaveTime?: string;

    @IsOptional()
    @IsIn(['ARRIVAL', 'DEPARTURE'])
    permissionScope?: 'ARRIVAL' | 'DEPARTURE';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    durationMinutes?: number;

    @IsOptional()
    @IsString()
    reason?: string;
}

export class PermissionDecisionDto {
    @IsOptional()
    @IsString()
    comment?: string;
}

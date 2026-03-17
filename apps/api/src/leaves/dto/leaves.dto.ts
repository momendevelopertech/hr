import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '@prisma/client';

export class CreateLeaveDto {
    @IsOptional()
    @IsString()
    userId?: string;

    @IsEnum(LeaveType)
    leaveType: LeaveType;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    attachmentUrl?: string;
}

export class UpdateLeaveDto {
    @IsOptional()
    @IsEnum(LeaveType)
    leaveType?: LeaveType;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    attachmentUrl?: string;
}

export class LeaveDecisionDto {
    @IsOptional()
    @IsString()
    comment?: string;
}

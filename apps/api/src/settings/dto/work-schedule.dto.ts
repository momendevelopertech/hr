import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import { Prisma, WorkScheduleMode } from '@prisma/client';

const timePattern = /^\d{2}:\d{2}$/;

export class UpdateWorkScheduleDto {
    @IsOptional()
    @IsEnum(WorkScheduleMode)
    activeMode?: WorkScheduleMode;

    @IsOptional()
    @IsString()
    @Matches(timePattern)
    weekdayStart?: string;

    @IsOptional()
    @IsString()
    @Matches(timePattern)
    weekdayEnd?: string;

    @IsOptional()
    @IsString()
    @Matches(timePattern)
    saturdayStart?: string;

    @IsOptional()
    @IsString()
    @Matches(timePattern)
    saturdayEnd?: string;

    @IsOptional()
    @IsString()
    @Matches(timePattern)
    ramadanStart?: string;

    @IsOptional()
    @IsString()
    @Matches(timePattern)
    ramadanEnd?: string;

    @IsOptional()
    @IsString()
    ramadanStartDate?: string | null;

    @IsOptional()
    @IsString()
    ramadanEndDate?: string | null;

    @IsOptional()
    @IsBoolean()
    pwaInstallEnabled?: boolean;

    @IsOptional()
    @IsString()
    evolutionApiBaseUrl?: string;

    @IsOptional()
    @IsString()
    evolutionApiKey?: string;

    @IsOptional()
    @IsObject()
    notificationTemplates?: Prisma.InputJsonValue;

    @IsOptional()
    @IsArray()
    calendarOffDays?: Prisma.InputJsonValue;
}

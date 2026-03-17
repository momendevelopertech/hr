import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateLatenessDto {
    @IsOptional()
    @IsString()
    userId?: string;

    @IsDateString()
    date: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    minutesLate: number;
}

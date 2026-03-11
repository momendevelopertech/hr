import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { addMonths, endOfDay, parseISO, setDate, startOfDay } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';

@Injectable()
export class LatenessService {
    constructor(
        private prisma: PrismaService,
        private permissionsService: PermissionsService,
    ) { }

    private normalizeDate(value: string) {
        const parsed = parseISO(value);
        if (!parsed || Number.isNaN(parsed.getTime())) {
            throw new BadRequestException('Invalid date');
        }
        return startOfDay(parsed);
    }

    private getCycleForDate(date: Date): { start: Date; end: Date } {
        const day = date.getDate();
        let cycleStart: Date;
        let cycleEnd: Date;

        if (day >= 11) {
            cycleStart = startOfDay(setDate(date, 11));
            cycleEnd = endOfDay(setDate(addMonths(date, 1), 10));
        } else {
            const prevMonth = addMonths(date, -1);
            cycleStart = startOfDay(setDate(prevMonth, 11));
            cycleEnd = endOfDay(setDate(date, 10));
        }

        return { start: cycleStart, end: cycleEnd };
    }

    private getDeductionDays(count: number) {
        if (count >= 3) return 1;
        if (count === 2) return 0.5;
        if (count === 1) return 0.25;
        return 0;
    }

    async createOrUpdate(userId: string, data: { date: string; minutesLate: number }) {
        const minutesLate = Math.max(0, Math.round(Number(data.minutesLate)));
        if (!minutesLate) {
            throw new BadRequestException('Minutes late must be greater than zero');
        }
        const date = this.normalizeDate(data.date);

        return this.prisma.lateness.upsert({
            where: { userId_date: { userId, date } },
            update: { minutesLate },
            create: {
                userId,
                date,
                minutesLate,
            },
        });
    }

    async findMine(userId: string, filters?: { from?: string; to?: string }) {
        let rangeStart: Date;
        let rangeEnd: Date;

        if (filters?.from || filters?.to) {
            rangeStart = filters?.from ? startOfDay(this.normalizeDate(filters.from)) : startOfDay(new Date(0));
            rangeEnd = filters?.to ? endOfDay(this.normalizeDate(filters.to)) : endOfDay(new Date());
        } else {
            const cycle = this.getCycleForDate(new Date());
            rangeStart = cycle.start;
            rangeEnd = cycle.end;
        }

        const items = await this.prisma.lateness.findMany({
            where: {
                userId,
                date: {
                    gte: rangeStart,
                    lte: rangeEnd,
                },
            },
            orderBy: { date: 'desc' },
        });

        const totalCount = items.length;
        const totalMinutes = items.reduce((sum, item) => sum + (item.minutesLate || 0), 0);
        const deductionDays = this.getDeductionDays(totalCount);

        return {
            items,
            totalCount,
            totalMinutes,
            deductionDays,
            cycleStart: rangeStart,
            cycleEnd: rangeEnd,
        };
    }

    async convertToPermission(userId: string, latenessId: string) {
        const lateness = await this.prisma.lateness.findUnique({ where: { id: latenessId } });
        if (!lateness) throw new NotFoundException('Not found');
        if (lateness.userId !== userId) throw new ForbiddenException();

        if (lateness.convertedToPermission && lateness.permissionId) {
            return this.prisma.permissionRequest.findUnique({ where: { id: lateness.permissionId } });
        }

        const permission = await this.permissionsService.createRequest(userId, {
            permissionType: 'LATE_ARRIVAL',
            requestDate: lateness.date,
            permissionScope: 'ARRIVAL',
            durationMinutes: lateness.minutesLate,
            reason: 'Converted from lateness entry',
        });

        await this.prisma.lateness.update({
            where: { id: lateness.id },
            data: {
                convertedToPermission: true,
                permissionId: permission.id,
            },
        });

        return permission;
    }
}

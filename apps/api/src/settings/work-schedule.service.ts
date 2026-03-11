import { Injectable } from '@nestjs/common';
import { Prisma, WorkScheduleMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_SETTINGS: Prisma.WorkScheduleSettingsCreateInput = {
    activeMode: WorkScheduleMode.NORMAL,
    weekdayStart: '09:00',
    weekdayEnd: '17:00',
    saturdayStart: '09:00',
    saturdayEnd: '13:30',
    ramadanStart: '09:00',
    ramadanEnd: '14:30',
    ramadanStartDate: null,
    ramadanEndDate: null,
    pwaInstallEnabled: false,
};

const getActiveMode = (
    value: Prisma.WorkScheduleSettingsUpdateInput['activeMode'],
): WorkScheduleMode | undefined => {
    if (typeof value === 'string') {
        if (value === WorkScheduleMode.NORMAL || value === WorkScheduleMode.RAMADAN) return value;
        return WorkScheduleMode.NORMAL;
    }
    if (value && typeof value === 'object' && 'set' in value) {
        const setValue = value.set;
        if (setValue === WorkScheduleMode.NORMAL || setValue === WorkScheduleMode.RAMADAN) return setValue;
    }
    return undefined;
};

const normalizeSettingsUpdate = (
    data: Prisma.WorkScheduleSettingsUpdateInput,
): Prisma.WorkScheduleSettingsUpdateInput => {
    const activeMode = getActiveMode(data.activeMode);
    return activeMode ? { ...data, activeMode } : data;
};

const toCreateInput = (
    data: Prisma.WorkScheduleSettingsUpdateInput,
): Prisma.WorkScheduleSettingsCreateInput => {
    const result: Prisma.WorkScheduleSettingsCreateInput = { ...DEFAULT_SETTINGS };
    const assignIfString = (key: keyof Prisma.WorkScheduleSettingsCreateInput) => {
        const value = (data as Record<string, unknown>)[key];
        if (typeof value === 'string' || value === null) {
            (result as Record<string, unknown>)[key] = value;
        }
    };
    const activeMode = getActiveMode(data.activeMode);
    if (activeMode) result.activeMode = activeMode;
    const pwaValue = (data as Record<string, unknown>).pwaInstallEnabled;
    if (typeof pwaValue === 'boolean') {
        result.pwaInstallEnabled = pwaValue;
    }
    assignIfString('weekdayStart');
    assignIfString('weekdayEnd');
    assignIfString('saturdayStart');
    assignIfString('saturdayEnd');
    assignIfString('ramadanStart');
    assignIfString('ramadanEnd');
    assignIfString('ramadanStartDate');
    assignIfString('ramadanEndDate');
    return result;
};

@Injectable()
export class WorkScheduleService {
    constructor(private prisma: PrismaService) { }

    private async ensureDefaults() {
        const existing = await this.prisma.workScheduleSettings.findFirst();
        if (existing) return existing;
        return this.prisma.workScheduleSettings.create({ data: DEFAULT_SETTINGS });
    }

    async getSettings() {
        return this.ensureDefaults();
    }

    async updateSettings(data: Prisma.WorkScheduleSettingsUpdateInput) {
        const normalized = normalizeSettingsUpdate(data);
        const existing = await this.prisma.workScheduleSettings.findFirst();
        if (!existing) {
            return this.prisma.workScheduleSettings.create({ data: toCreateInput(normalized) });
        }
        return this.prisma.workScheduleSettings.update({
            where: { id: existing.id },
            data: normalized,
        });
    }
}

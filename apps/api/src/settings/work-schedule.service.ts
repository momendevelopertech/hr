import { Injectable } from '@nestjs/common';
import { Prisma, WorkScheduleMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WHAPI_BASE_URL } from './whapi-defaults';

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
    whapiBaseUrl: DEFAULT_WHAPI_BASE_URL,
    whapiToken: null,
};

const BASE_SELECT = {
    id: true,
    activeMode: true,
    weekdayStart: true,
    weekdayEnd: true,
    saturdayStart: true,
    saturdayEnd: true,
    ramadanStart: true,
    ramadanEnd: true,
    ramadanStartDate: true,
    ramadanEndDate: true,
    createdAt: true,
    updatedAt: true,
};

const FULL_SELECT = {
    ...BASE_SELECT,
    pwaInstallEnabled: true,
    whapiBaseUrl: true,
    whapiToken: true,
};

const isMissingColumnError = (error: unknown) => {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'P2022') return true;
    if (typeof err?.message === 'string' && err.message.includes('pwaInstallEnabled') && err.message.includes('does not exist')) {
        return true;
    }
    return false;
};

const withPwaFallback = <T extends Record<string, any> | null>(data: T, value?: boolean) => {
    if (!data) return data;
    return { ...data, pwaInstallEnabled: value ?? false } as T & { pwaInstallEnabled: boolean };
};

const serializeSettings = <T extends Record<string, any> | null>(data: T) => {
    if (!data) return data;
    const { whapiToken: _whapiToken, ...rest } = data;
    return {
        ...rest,
        whapiTokenConfigured: !!_whapiToken,
    };
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
    const whapiBaseUrl = (data as Record<string, unknown>).whapiBaseUrl;
    if (typeof whapiBaseUrl === 'string' && whapiBaseUrl.trim()) {
        result.whapiBaseUrl = whapiBaseUrl.trim();
    }
    const whapiToken = (data as Record<string, unknown>).whapiToken;
    if (typeof whapiToken === 'string') {
        result.whapiToken = whapiToken.trim() || null;
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

    private async safeFindFirst() {
        try {
            return await this.prisma.workScheduleSettings.findFirst({ select: FULL_SELECT });
        } catch (error) {
            if (!isMissingColumnError(error)) throw error;
            const legacy = await this.prisma.workScheduleSettings.findFirst({ select: BASE_SELECT });
            return withPwaFallback(legacy, false);
        }
    }

    private async safeCreate(data: Prisma.WorkScheduleSettingsCreateInput) {
        try {
            return await this.prisma.workScheduleSettings.create({ data, select: FULL_SELECT });
        } catch (error) {
            if (!isMissingColumnError(error)) throw error;
            const legacyData = { ...data } as Record<string, any>;
            delete legacyData.pwaInstallEnabled;
            delete legacyData.whapiBaseUrl;
            delete legacyData.whapiToken;
            const legacy = await this.prisma.workScheduleSettings.create({ data: legacyData, select: BASE_SELECT });
            return withPwaFallback(legacy, false);
        }
    }

    private async safeUpdate(id: string, data: Prisma.WorkScheduleSettingsUpdateInput) {
        try {
            return await this.prisma.workScheduleSettings.update({ where: { id }, data, select: FULL_SELECT });
        } catch (error) {
            if (!isMissingColumnError(error)) throw error;
            const legacyData = { ...(data as Record<string, any>) };
            delete legacyData.pwaInstallEnabled;
            delete legacyData.whapiBaseUrl;
            delete legacyData.whapiToken;
            const legacy = await this.prisma.workScheduleSettings.update({ where: { id }, data: legacyData, select: BASE_SELECT });
            return withPwaFallback(legacy, false);
        }
    }

    private async ensureDefaults() {
        const existing = await this.safeFindFirst();
        if (existing) return existing;
        return this.safeCreate(DEFAULT_SETTINGS);
    }

    async getSettings() {
        const settings = await this.ensureDefaults();
        return serializeSettings(settings);
    }

    async updateSettings(data: Prisma.WorkScheduleSettingsUpdateInput) {
        const normalized = normalizeSettingsUpdate(data);
        const rawWhapiBaseUrl = (data as Record<string, unknown>).whapiBaseUrl;
        const rawWhapiToken = (data as Record<string, unknown>).whapiToken;
        const updateData: Prisma.WorkScheduleSettingsUpdateInput = {
            ...normalized,
            ...(typeof rawWhapiBaseUrl === 'string' && rawWhapiBaseUrl.trim()
                ? { whapiBaseUrl: rawWhapiBaseUrl.trim() }
                : {}),
            ...(typeof rawWhapiToken === 'string' && rawWhapiToken.trim()
                ? { whapiToken: rawWhapiToken.trim() }
                : {}),
        };
        const existing = await this.safeFindFirst();
        if (!existing) {
            const created = await this.safeCreate(toCreateInput(updateData));
            return serializeSettings(created);
        }
        const updated = await this.safeUpdate(existing.id, updateData);
        return serializeSettings(updated);
    }
}

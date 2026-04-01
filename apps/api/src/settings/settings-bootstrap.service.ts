import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_WHAPI_BASE_URL, DEFAULT_WHAPI_SETTINGS } from './whapi-defaults';

@Injectable()
export class SettingsBootstrapService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SettingsBootstrapService.name);

    constructor(private readonly prisma: PrismaService) { }

    async onApplicationBootstrap() {
        try {
            const existing = await this.prisma.workScheduleSettings.findFirst({
                select: {
                    id: true,
                    whapiBaseUrl: true,
                },
            });

            if (!existing) {
                await this.prisma.workScheduleSettings.create({
                    data: DEFAULT_WHAPI_SETTINGS,
                });
                this.logger.log('Created work schedule settings with default Whapi config.');
                return;
            }

            const hasExpectedBaseUrl = existing.whapiBaseUrl?.trim() === DEFAULT_WHAPI_BASE_URL;
            if (hasExpectedBaseUrl) {
                return;
            }

            await this.prisma.workScheduleSettings.update({
                where: { id: existing.id },
                data: { whapiBaseUrl: DEFAULT_WHAPI_BASE_URL },
            });
            this.logger.log('Synchronized default Whapi base URL into work schedule settings.');
        } catch (error: any) {
            if (error?.code === 'P2022') {
                this.logger.warn('Skipping Whapi bootstrap because the required settings columns are not available yet.');
                return;
            }

            throw error;
        }
    }
}

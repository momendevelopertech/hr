import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_EVOLUTION_API_BASE_URL, DEFAULT_WHATSAPP_SETTINGS } from './whatsapp-defaults';

@Injectable()
export class SettingsBootstrapService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SettingsBootstrapService.name);

    constructor(private readonly prisma: PrismaService) { }

    async onApplicationBootstrap() {
        try {
            const existing = await this.prisma.workScheduleSettings.findFirst({
                select: {
                    id: true,
                    evolutionApiBaseUrl: true,
                },
            });

            if (!existing) {
                await this.prisma.workScheduleSettings.create({
                    data: DEFAULT_WHATSAPP_SETTINGS,
                });
                this.logger.log('Created work schedule settings with default Evolution API config.');
                return;
            }

            const hasExpectedBaseUrl = existing.evolutionApiBaseUrl?.trim() === DEFAULT_EVOLUTION_API_BASE_URL;
            if (hasExpectedBaseUrl) {
                return;
            }

            await this.prisma.workScheduleSettings.update({
                where: { id: existing.id },
                data: { evolutionApiBaseUrl: DEFAULT_EVOLUTION_API_BASE_URL },
            });
            this.logger.log('Synchronized default Evolution API base URL into work schedule settings.');
        } catch (error: any) {
            if (error?.code === 'P2022') {
                this.logger.warn('Skipping WhatsApp bootstrap because the required settings columns are not available yet.');
                return;
            }

            throw error;
        }
    }
}

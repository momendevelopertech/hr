import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEgyptMobilePhone } from '../shared/egypt-phone';

type WhatsAppConfigCandidate = {
    apiKey?: string | null;
    baseUrl: string;
    source: 'database' | 'environment';
};

export type WhatsAppDeliveryResult = {
    ok: boolean;
    phone: string;
    attempts: number;
    source?: WhatsAppConfigCandidate['source'];
    status?: number;
    error?: string;
};

const EGYPT_LOCAL_MOBILE = /^01\d{9}$/;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_ATTEMPTS = 3;

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);

    constructor(private readonly prisma: PrismaService) { }

    formatEgyptianNumber(phone?: string | null) {
        const normalized = normalizeEgyptMobilePhone(phone);
        if (!EGYPT_LOCAL_MOBILE.test(normalized)) {
            throw new Error('Phone number must be a valid Egyptian mobile number');
        }
        return `20${normalized.slice(1)}`;
    }

    async hasConfig() {
        return (await this.getConfigCandidates()).length > 0;
    }

    async sendWhatsApp(phone: string, message: string): Promise<WhatsAppDeliveryResult> {
        if (!phone) {
            this.logger.warn('WhatsApp phone is missing');
            return { ok: false, phone: '', attempts: 0, error: 'WhatsApp phone is missing' };
        }

        if (!message?.trim()) {
            this.logger.warn('WhatsApp message is empty');
            return { ok: false, phone, attempts: 0, error: 'WhatsApp message is empty' };
        }

        let formattedPhone = '';
        try {
            formattedPhone = this.formatEgyptianNumber(phone);
        } catch (error: any) {
            const errorMessage = error?.message || 'WhatsApp phone is invalid';
            this.logger.warn(`WhatsApp phone is invalid: ${phone}`);
            return { ok: false, phone, attempts: 0, error: errorMessage };
        }

        const configs = await this.getConfigCandidates();
        if (!configs.length) {
            this.logger.warn('Evolution API is not configured');
            return { ok: false, phone: formattedPhone, attempts: 0, error: 'Evolution API is not configured' };
        }

        let lastFailure: WhatsAppDeliveryResult = {
            ok: false,
            phone: formattedPhone,
            attempts: 0,
            error: 'Unknown WhatsApp delivery failure',
        };

        for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
            for (const config of configs) {
                try {
                    const response = await axios.post(
                        `${config.baseUrl}/message/sendText`,
                        {
                            number: formattedPhone,
                            text: message,
                        },
                        {
                            headers: this.buildHeaders(config.baseUrl, config.apiKey),
                            timeout: this.getRequestTimeout(),
                            validateStatus: () => true,
                        },
                    );

                    if (response.status >= 200 && response.status < 300) {
                        this.logger.log(`WhatsApp sent to ${formattedPhone} using ${config.source} Evolution config`);
                        return {
                            ok: true,
                            phone: formattedPhone,
                            attempts: attempt,
                            source: config.source,
                            status: response.status,
                        };
                    }

                    const errorMessage = this.extractErrorMessage(response.data, response.status);
                    lastFailure = {
                        ok: false,
                        phone: formattedPhone,
                        attempts: attempt,
                        source: config.source,
                        status: response.status,
                        error: errorMessage,
                    };
                    this.logger.warn(`WhatsApp send failed via ${config.source} (attempt ${attempt}/${DEFAULT_RETRY_ATTEMPTS}): ${errorMessage}`);
                } catch (error: any) {
                    const errorMessage = this.extractErrorMessage(error?.response?.data, error?.response?.status, error?.message);
                    lastFailure = {
                        ok: false,
                        phone: formattedPhone,
                        attempts: attempt,
                        source: config.source,
                        status: error?.response?.status,
                        error: errorMessage,
                    };
                    this.logger.warn(`WhatsApp request error via ${config.source} (attempt ${attempt}/${DEFAULT_RETRY_ATTEMPTS}): ${errorMessage}`);
                }
            }

            if (attempt < DEFAULT_RETRY_ATTEMPTS) {
                await this.waitBeforeRetry();
            }
        }

        if (lastFailure.error) {
            this.logger.error(`WhatsApp delivery failed for ${formattedPhone}: ${lastFailure.error}`);
        }

        return lastFailure;
    }

    private async getConfigCandidates() {
        const candidates: WhatsAppConfigCandidate[] = [];
        const pushCandidate = (
            baseUrl?: string | null,
            apiKey?: string | null,
            source: WhatsAppConfigCandidate['source'] = 'environment',
        ) => {
            const normalizedBaseUrl = this.normalizeBaseUrl(baseUrl);
            if (!normalizedBaseUrl) return;

            const normalizedApiKey = apiKey?.trim() || null;
            if (candidates.some((item) => item.baseUrl === normalizedBaseUrl && (item.apiKey || '') === (normalizedApiKey || ''))) {
                return;
            }

            candidates.push({
                apiKey: normalizedApiKey,
                baseUrl: normalizedBaseUrl,
                source,
            });
        };

        pushCandidate(process.env.EVOLUTION_API_BASE_URL, process.env.EVOLUTION_API_KEY, 'environment');

        try {
            const settings = await this.prisma.workScheduleSettings.findFirst({
                select: {
                    evolutionApiBaseUrl: true,
                    evolutionApiKey: true,
                },
            });

            pushCandidate(settings?.evolutionApiBaseUrl, settings?.evolutionApiKey, 'database');
        } catch (error: any) {
            if (error?.code !== 'P2022') {
                throw error;
            }
        }

        return candidates;
    }

    private normalizeBaseUrl(baseUrl?: string | null) {
        const normalized = (baseUrl || '').trim().replace(/\/+$/, '');
        if (!normalized) return '';
        if (/whapi/i.test(normalized)) return '';
        return normalized;
    }

    private getRequestTimeout() {
        const parsed = parseInt(process.env.EVOLUTION_API_TIMEOUT_MS || '', 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
    }

    private buildHeaders(baseUrl: string, apiKey?: string | null) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (/\.ngrok(-free)?\.(app|dev)$/i.test(baseUrl)) {
            headers['ngrok-skip-browser-warning'] = '1';
        }

        if (apiKey) {
            headers.apikey = apiKey;
        }

        return headers;
    }

    private extractErrorMessage(payload: any, status?: number, fallback?: string) {
        return (
            payload?.response?.message
            || payload?.message
            || payload?.error
            || fallback
            || (status ? `WhatsApp send failed with status ${status}` : 'Unknown WhatsApp error')
        );
    }

    private waitBeforeRetry() {
        return new Promise((resolve) => setTimeout(resolve, 500));
    }
}

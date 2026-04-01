jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    },
}));

import axios from 'axios';
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService', () => {
    const originalEnv = { ...process.env };
    const prisma = {
        workScheduleSettings: {
            findFirst: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            EVOLUTION_API_BASE_URL: 'https://evolution.example.com',
            EVOLUTION_API_KEY: 'token',
            EVOLUTION_API_TIMEOUT_MS: '1000',
        };
        prisma.workScheduleSettings.findFirst.mockResolvedValue(null);
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('retries WhatsApp delivery up to three attempts before succeeding', async () => {
        (axios.post as jest.Mock)
            .mockResolvedValueOnce({ status: 500, data: { message: 'failed-1' } })
            .mockResolvedValueOnce({ status: 500, data: { message: 'failed-2' } })
            .mockResolvedValueOnce({ status: 200, data: { id: 'ok' } });

        const service = new WhatsAppService(prisma as any);
        (service as any).waitBeforeRetry = jest.fn().mockResolvedValue(undefined);

        const result = await service.sendWhatsApp('01012345678', 'hello world');

        expect(result).toEqual({
            ok: true,
            phone: '201012345678',
            attempts: 3,
            source: 'environment',
            status: 200,
        });
        expect(axios.post).toHaveBeenCalledTimes(3);
    });

    it('returns a validation error for invalid Egyptian mobile numbers without attempting delivery', async () => {
        const service = new WhatsAppService(prisma as any);

        const result = await service.sendWhatsApp('012345', 'hello world');

        expect(result.ok).toBe(false);
        expect(result.attempts).toBe(0);
        expect(result.error).toContain('valid Egyptian mobile number');
        expect(axios.post).not.toHaveBeenCalled();
    });
});

jest.mock('nodemailer', () => ({
    createTransport: jest.fn(),
}));

import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

describe('EmailService', () => {
    const originalEnv = { ...process.env };
    const sendMail = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            MAIL_HOST: 'smtp.example.com',
            MAIL_PORT: '587',
            MAIL_USER: 'mailer@example.com',
            MAIL_PASS: 'secret',
            MAIL_FROM: '',
            SENDER_EMAIL: 'sender@example.com',
            SENDER_NAME: 'SPHINX HR',
            MAIL_SECURE: 'false',
            MAIL_REQUIRE_TLS: 'true',
        };
        (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('retries SMTP delivery up to three attempts and succeeds on the last one', async () => {
        sendMail
            .mockRejectedValueOnce(new Error('temporary failure'))
            .mockRejectedValueOnce(new Error('temporary failure again'))
            .mockResolvedValueOnce({ messageId: 'msg-3', response: '250 queued' });

        const service = new EmailService();
        (service as any).waitBeforeRetry = jest.fn().mockResolvedValue(undefined);

        const result = await service.sendEmail({
            to: 'employee@example.com',
            subject: 'Welcome',
            html: '<p>Hello</p>',
        });

        expect(result).toEqual({
            ok: true,
            recipient: 'employee@example.com',
            attempts: 3,
            messageId: 'msg-3',
            response: '250 queued',
        });
        expect(sendMail).toHaveBeenCalledTimes(3);
    });

    it('builds the sender header from SENDER_NAME and SENDER_EMAIL when MAIL_FROM is empty', async () => {
        sendMail.mockResolvedValue({ messageId: 'msg-1', response: '250 queued' });

        const service = new EmailService();

        await service.sendEmail({
            to: 'employee@example.com',
            subject: 'Hello',
            html: '<p>Body</p>',
        });

        expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
            from: 'SPHINX HR <sender@example.com>',
            to: 'employee@example.com',
            subject: 'Hello',
        }));
    });
});

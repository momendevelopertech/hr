import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export type EmailDeliveryResult = {
    ok: boolean;
    recipient: string;
    attempts: number;
    messageId?: string;
    response?: string;
    error?: string;
};

type SendEmailOptions = {
    to: string;
    subject: string;
    html: string;
};

const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private transporter?: nodemailer.Transporter;

    hasConfig() {
        return Boolean(this.getMailHost() && this.getMailUser() && this.getMailPass());
    }

    async sendEmail(options: SendEmailOptions): Promise<EmailDeliveryResult> {
        if (!options.to?.trim()) {
            this.logger.warn('Email recipient is missing');
            return { ok: false, recipient: '', attempts: 0, error: 'Email recipient is missing' };
        }

        if (!options.subject?.trim()) {
            this.logger.warn(`Email subject is missing for ${options.to}`);
            return { ok: false, recipient: options.to, attempts: 0, error: 'Email subject is missing' };
        }

        if (!options.html?.trim()) {
            this.logger.warn(`Email HTML body is missing for ${options.to}`);
            return { ok: false, recipient: options.to, attempts: 0, error: 'Email HTML body is missing' };
        }

        if (!this.hasConfig()) {
            this.logger.warn('Email not configured');
            return { ok: false, recipient: options.to, attempts: 0, error: 'Email not configured' };
        }

        let lastError = 'Unknown email delivery failure';

        for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
            try {
                const info = await this.getTransporter().sendMail({
                    from: this.getMailFrom(),
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                });

                this.logger.log(`Email sent to ${options.to} on attempt ${attempt}`);
                return {
                    ok: true,
                    recipient: options.to,
                    attempts: attempt,
                    messageId: info.messageId,
                    response: typeof info.response === 'string' ? info.response : undefined,
                };
            } catch (error: any) {
                lastError = error?.message || 'Unknown email delivery failure';

                if (attempt < DEFAULT_RETRY_ATTEMPTS) {
                    this.logger.warn(`Email send failed (attempt ${attempt}/${DEFAULT_RETRY_ATTEMPTS}) for ${options.to}: ${lastError}. Retrying.`);
                    await this.waitBeforeRetry();
                    continue;
                }

                this.logger.error(`Email send failed for ${options.to}: ${lastError}`);
            }
        }

        return {
            ok: false,
            recipient: options.to,
            attempts: DEFAULT_RETRY_ATTEMPTS,
            error: lastError,
        };
    }

    private getTransporter() {
        if (!this.transporter) {
            this.transporter = nodemailer.createTransport({
                host: this.getMailHost(),
                port: this.getMailPort(),
                secure: this.isSecure(),
                pool: true,
                maxConnections: this.getMaxConnections(),
                maxMessages: this.getMaxMessages(),
                auth: {
                    user: this.getMailUser(),
                    pass: this.getMailPass(),
                },
                requireTLS: this.getRequireTls(),
                tls: {
                    rejectUnauthorized: this.getRejectUnauthorized(),
                },
            });
        }

        return this.transporter;
    }

    private getMailHost() {
        return (process.env.MAIL_HOST || '').trim();
    }

    private getMailPort() {
        const parsed = parseInt(process.env.MAIL_PORT || '', 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
    }

    private getMailUser() {
        return (process.env.MAIL_USER || '').trim();
    }

    private getMailPass() {
        return process.env.MAIL_PASS || '';
    }

    private getMailFrom() {
        const senderEmail = (process.env.SENDER_EMAIL || '').trim();
        const senderName = (process.env.SENDER_NAME || 'SPHINX HR').trim();
        if (process.env.MAIL_FROM?.trim()) {
            return process.env.MAIL_FROM.trim();
        }
        if (senderEmail) {
            return `${senderName} <${senderEmail}>`;
        }
        if (this.getMailUser()) {
            return `${senderName} <${this.getMailUser()}>`;
        }
        return 'SPHINX HR <noreply@sphinx.com>';
    }

    private isSecure() {
        const configured = this.parseBoolean(process.env.MAIL_SECURE);
        if (configured !== null) {
            return configured;
        }
        return this.getMailPort() === 465;
    }

    private getRequireTls() {
        const configured = this.parseBoolean(process.env.MAIL_REQUIRE_TLS);
        if (configured !== null) {
            return configured;
        }
        return !this.isSecure();
    }

    private getRejectUnauthorized() {
        const configured = this.parseBoolean(process.env.MAIL_TLS_REJECT_UNAUTHORIZED);
        return configured ?? true;
    }

    private getMaxConnections() {
        const parsed = parseInt(process.env.MAIL_POOL_MAX_CONNECTIONS || '', 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
    }

    private getMaxMessages() {
        const parsed = parseInt(process.env.MAIL_POOL_MAX_MESSAGES || '', 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
    }

    private parseBoolean(value?: string | null) {
        const normalized = (value || '').trim().toLowerCase();
        if (!normalized) return null;
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
        return null;
    }

    private waitBeforeRetry() {
        return new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_DELAY_MS));
    }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client: Redis | null;
    private connectPromise: Promise<void> | null = null;
    private readonly disabled: boolean;

    constructor() {
        this.disabled =
            process.env.DISABLE_REDIS === '1'
            || (process.env.NODE_ENV === 'test' && process.env.DISABLE_REDIS !== '0');

        if (this.disabled) {
            this.client = null;
            this.logger.warn('Redis is disabled for the current environment.');
            return;
        }

        this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
        });
        this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    }

    private async ensureConnected(): Promise<void> {
        if (!this.client) return;
        if (this.client.status !== 'wait') return;
        if (!this.connectPromise) {
            this.connectPromise = this.client.connect().catch(() => undefined).finally(() => {
                this.connectPromise = null;
            });
        }
        await this.connectPromise;
    }

    getClient() {
        return this.client;
    }

    async getJSON<T>(key: string): Promise<T | null> {
        if (!this.client) return null;
        try {
            await this.ensureConnected();
            const value = await this.client.get(key);
            return value ? (JSON.parse(value) as T) : null;
        } catch {
            return null;
        }
    }

    async setJSON(key: string, value: any, ttlSeconds = 30) {
        if (!this.client) return;
        try {
            await this.ensureConnected();
            await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch {
            return;
        }
    }

    async del(key: string) {
        if (!this.client) return;
        try {
            await this.ensureConnected();
            await this.client.del(key);
        } catch {
            return;
        }
    }

    async onModuleDestroy() {
        if (!this.client) return;
        await this.client.quit().catch(() => undefined);
    }
}

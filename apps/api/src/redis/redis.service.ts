import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private client: Redis;

    constructor() {
        this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            lazyConnect: true,
            enableOfflineQueue: false,
            maxRetriesPerRequest: 1,
        });
        this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    }

    getClient() {
        return this.client;
    }

    async getJSON<T>(key: string): Promise<T | null> {
        const value = await this.client.get(key);
        return value ? (JSON.parse(value) as T) : null;
    }

    async setJSON(key: string, value: any, ttlSeconds = 30) {
        await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }

    async del(key: string) {
        await this.client.del(key);
    }

    async onModuleDestroy() {
        await this.client.quit();
    }
}

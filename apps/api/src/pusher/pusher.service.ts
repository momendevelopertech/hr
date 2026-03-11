import { Injectable, Logger } from '@nestjs/common';
import Pusher from 'pusher';

type PusherPayload = Record<string, any>;

@Injectable()
export class PusherService {
    private readonly logger = new Logger(PusherService.name);
    private readonly client: Pusher | null;

    constructor() {
        const appId = process.env.PUSHER_APP_ID || '';
        const key = process.env.PUSHER_KEY || '';
        const secret = process.env.PUSHER_SECRET || '';
        const cluster = process.env.PUSHER_CLUSTER || '';

        if (!appId || !key || !secret || !cluster) {
            this.client = null;
            this.logger.warn('Pusher is not configured. Real-time events will be disabled.');
            return;
        }

        this.client = new Pusher({
            appId,
            key,
            secret,
            cluster,
            useTLS: true,
        });
    }

    getUserChannel(userId: string) {
        return `user-${userId}`;
    }

    async trigger(channel: string, event: string, payload: PusherPayload) {
        if (!this.client) return;
        try {
            await this.client.trigger(channel, event, payload);
        } catch (err: any) {
            this.logger.error(`Pusher trigger failed: ${err.message}`);
        }
    }

    async triggerToUser(userId: string, event: string, payload: PusherPayload) {
        return this.trigger(this.getUserChannel(userId), event, payload);
    }
}

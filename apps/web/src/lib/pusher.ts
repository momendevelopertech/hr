import Pusher, { Channel } from 'pusher-js';

let client: Pusher | null = null;
const channelRefs = new Map<string, number>();

const getConfig = () => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || '';
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || '';
    return { key, cluster };
};

export const getPusherClient = () => {
    if (client) return client;
    const { key, cluster } = getConfig();
    if (!key || !cluster) return null;
    client = new Pusher(key, {
        cluster,
        forceTLS: true,
    });
    return client;
};

export const subscribeChannel = (name: string): Channel | null => {
    const pusher = getPusherClient();
    if (!pusher) return null;
    const existing = pusher.channel(name);
    const channel = existing || pusher.subscribe(name);
    channelRefs.set(name, (channelRefs.get(name) || 0) + 1);
    return channel;
};

export const releaseChannel = (name: string) => {
    const pusher = getPusherClient();
    if (!pusher) return;
    const next = (channelRefs.get(name) || 1) - 1;
    if (next <= 0) {
        channelRefs.delete(name);
        pusher.unsubscribe(name);
        return;
    }
    channelRefs.set(name, next);
};

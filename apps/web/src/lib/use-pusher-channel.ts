'use client';

import { useEffect } from 'react';
import { Channel } from 'pusher-js';
import { releaseChannel, subscribeChannel } from './pusher';

type Handler = (data: any) => void;

export const usePusherChannel = (
    channelName: string | null | undefined,
    handlers: Record<string, Handler>,
) => {
    useEffect(() => {
        if (!channelName) return;
        const channel = subscribeChannel(channelName);
        if (!channel) return;

        Object.entries(handlers).forEach(([event, handler]) => {
            channel.bind(event, handler);
        });

        return () => {
            Object.entries(handlers).forEach(([event, handler]) => {
                channel.unbind(event, handler);
            });
            releaseChannel(channelName);
        };
    }, [channelName, handlers]);
};

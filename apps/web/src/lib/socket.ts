import { io, Socket } from 'socket.io-client';
import { getPublicSocketUrl } from './public-urls';

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket) {
        socket = io(getPublicSocketUrl(), {
            withCredentials: true,
            // Start with HTTP long-polling so auth cookies are reliably attached,
            // then allow Socket.IO to upgrade to WebSocket when available.
            transports: ['polling', 'websocket'],
        });
    }
    return socket;
};

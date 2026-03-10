import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { socketCorsOrigin } from '../shared/cors-origin';

@WebSocketGateway({
    cors: {
        origin: true,
        credentials: true,
    },
    namespace: '/',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger(EventsGateway.name);
    private userSockets = new Map<string, string[]>();

    afterInit() {
        this.logger.log('WebSocket Gateway initialized');
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Remove socket from user map
        this.userSockets.forEach((sockets, userId) => {
            const filtered = sockets.filter((s) => s !== client.id);
            if (filtered.length === 0) {
                this.userSockets.delete(userId);
            } else {
                this.userSockets.set(userId, filtered);
            }
        });
    }

    @SubscribeMessage('join')
    handleJoin(client: Socket, userId: string) {
        client.join(`user:${userId}`);
        const existing = this.userSockets.get(userId) || [];
        this.userSockets.set(userId, [...existing, client.id]);
        client.emit('joined', { userId });
        this.logger.log(`User ${userId} joined their room`);
    }

    sendToUser(userId: string, event: string, data: any) {
        this.server.to(`user:${userId}`).emit(event, data);
    }

    broadcast(event: string, data: any) {
        this.server.emit(event, data);
    }

    sendToRoom(room: string, event: string, data: any) {
        this.server.to(room).emit(event, data);
    }
}

import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { corsOriginDelegate } from '../shared/cors.util';

type JoinPayload = { employeeId: string };
type SendPayload = { senderId: string; receiverId: string; messageText: string };
type ReadPayload = { readerId: string; senderId: string };

@WebSocketGateway({
    cors: {
        origin: corsOriginDelegate,
        credentials: true,
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger = new Logger(ChatGateway.name);

    constructor(private chatService: ChatService) { }

    handleConnection(client: Socket) {
        this.logger.log(`connect: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`disconnect: ${client.id}`);
    }

    @SubscribeMessage('join_user_room')
    handleJoinUserRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
        client.join(`user:${payload.employeeId}`);
        return { joined: `user:${payload.employeeId}` };
    }

    @SubscribeMessage('send_message')
    async handleSendMessage(@MessageBody() payload: SendPayload) {
        const saved = await this.chatService.sendMessage(payload.senderId, {
            receiverId: payload.receiverId,
            messageText: payload.messageText,
        });

        this.server.to(`user:${payload.receiverId}`).emit('receive_message', saved);
        this.server.to(`user:${payload.senderId}`).emit('receive_message', saved);

        return saved;
    }

    @SubscribeMessage('message_read')
    async handleMessageRead(@MessageBody() payload: ReadPayload) {
        await this.chatService.markAsRead(payload.readerId, payload.senderId);
        this.server.to(`user:${payload.senderId}`).emit('message_read', payload);
        return { success: true };
    }
}

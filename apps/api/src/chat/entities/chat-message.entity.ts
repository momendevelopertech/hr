export class ChatMessageEntity {
    id: string;
    senderId: string;
    receiverId: string;
    messageText: string;
    createdAt: Date;
    readStatus: boolean;
}

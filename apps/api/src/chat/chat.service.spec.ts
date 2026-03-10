import { ChatService } from './chat.service';

describe('ChatService', () => {
    const prisma = {
        message: {
            findMany: jest.fn(),
            groupBy: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
        },
        user: {
            findMany: jest.fn(),
        },
    };

    let service: ChatService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ChatService(prisma as any);
    });

    it('returns previous conversation partners with latest message and unread count', async () => {
        prisma.message.findMany.mockResolvedValue([
            { senderId: 'u1', receiverId: 'u2', messageText: 'last to sara', createdAt: new Date('2025-01-03T10:00:00Z') },
            { senderId: 'u3', receiverId: 'u1', messageText: 'hello from ali', createdAt: new Date('2025-01-02T10:00:00Z') },
            { senderId: 'u1', receiverId: 'u2', messageText: 'older', createdAt: new Date('2025-01-01T10:00:00Z') },
        ]);
        prisma.message.groupBy.mockResolvedValue([
            { senderId: 'u3', _count: { _all: 2 } },
        ]);
        prisma.user.findMany.mockResolvedValue([
            { id: 'u2', fullName: 'Sara', jobTitle: 'HR', governorate: 'CAIRO' },
            { id: 'u3', fullName: 'Ali', jobTitle: 'Support', governorate: 'ALEXANDRIA' },
            { id: 'u4', fullName: 'No Chat User', jobTitle: 'Employee', governorate: 'CAIRO' },
        ]);

        const result = await service.getEmployeeChats('u1');

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            id: 'u2',
            lastMessage: 'last to sara',
            unreadCount: 0,
        });
        expect(result[1]).toMatchObject({
            id: 'u3',
            lastMessage: 'hello from ali',
            unreadCount: 2,
        });
    });

    it('saves and fetches a two-employee conversation in chronological order', async () => {
        const storedMessage = {
            id: 'm1',
            senderId: 'u1',
            receiverId: 'u2',
            messageText: 'Hello from user 1',
            createdAt: new Date('2025-01-01T08:00:00Z'),
            readStatus: false,
        };
        prisma.message.create.mockResolvedValue(storedMessage);
        prisma.message.findMany.mockResolvedValue([
            storedMessage,
            {
                id: 'm2',
                senderId: 'u2',
                receiverId: 'u1',
                messageText: 'Reply from user 2',
                createdAt: new Date('2025-01-01T08:01:00Z'),
                readStatus: false,
            },
        ]);

        const sendResult = await service.sendMessage('u1', {
            receiverId: 'u2',
            messageText: 'Hello from user 1',
        });
        const conversation = await service.getConversation('u1', 'u2');

        expect(sendResult).toEqual(storedMessage);
        expect(conversation).toHaveLength(2);
        expect(conversation[0].messageText).toBe('Hello from user 1');
        expect(conversation[1].messageText).toBe('Reply from user 2');
    });

});

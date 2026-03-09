export type ChatEmployee = {
    id: string;
    fullName: string;
    jobTitle?: string | null;
    governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
    unreadCount?: number;
};

export type ChatMessage = {
    id: string;
    senderId: string;
    receiverId: string;
    messageText: string;
    createdAt: string;
    readStatus: boolean;
};

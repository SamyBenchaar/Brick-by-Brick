export interface ChatMessage {
    _id?: string;
    username: string;
    content: string;
    timestamp: Date;
    gameId?: string;
    hostPlayerId?: string;
}

export enum MessageType {
    CHAT = 'chat',
    LOG = 'log',
}

export interface LogMessage {
    _id: string;
    timestamp: Date;
    type: 'global' | 'combat';
    content: string;
    playersInvolved?: string[];
}
export interface ChatMessage {
    _id?: string;
    username: string;
    content: string;
    timestamp: Date;
    gameId?: string;
}

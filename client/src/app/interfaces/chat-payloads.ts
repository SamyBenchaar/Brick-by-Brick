export interface SendChatMessagePayload {
    username: string;
    content: string;
    gameId?: string;
    hostPlayerId?: string;
}
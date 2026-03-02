export enum GameEvents {
    RequestGameList = 'requestGameList',
    RequestVisibleGameList = 'requestVisibleGameList',
    GameCreated = 'gameCreated',
    GameUpdated = 'gameUpdated',
    GameDeleted = 'gameDeleted',
    GameList = 'gameList',
}

export enum ChatEvents {
    SendMessage = 'sendMessage',
    ReceiveMessage = 'receiveMessage',
    LoadChatHistory = 'loadChatHistory',
    ChatHistory = 'chatHistory',
}
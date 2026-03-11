export enum GameEvents {
    RequestGameList = 'requestGameList',
    RequestVisibleGameList = 'requestVisibleGameList',
    GameCreated = 'gameCreated',
    GameUpdated = 'gameUpdated',
    GameDeleted = 'gameDeleted',
    GameList = 'gameList',
}

export enum GameSessionEvents {
    RequestGameSessionList = 'requestGameSessionList',
    GameSessionList = 'gameSessionList',
    GameSessionListUpdated = 'gameSessionListUpdated',

    GameSessionCreated = 'gameSessionCreated',
    GameSessionUpdated = 'gameSessionUpdated',
    GameSessionDeleted = 'gameSessionDeleted',

    CreateGameSession = 'createGameSession',
    JoinGameSession = 'joinGameSession',
    GameSessionJoinError = 'gameSessionJoinError',
    GameSessionFull = 'gameSessionFull',
    LeaveGameSession = 'leaveGameSession',

    AvatarTakenUpdated = 'avatarTakenUpdated',
    ObserveGameSession = 'observeGameSession',

    KickPlayer = 'kickPlayer',
    PlayerKicked = 'playerKicked',
    RoomCancelled = 'roomCancelled',

    StartGame = 'startGame',
    GameStarted = 'gameStarted',
}

export enum ChatEvents {
    SendMessage = 'sendMessage',
    ReceiveMessage = 'receiveMessage',
    LoadChatHistory = 'loadChatHistory',
    ChatHistory = 'chatHistory',
    ClearChatHistory = 'clearChatHistory',
}
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
    LeaveGameSession = 'leaveGameSession',

    LockGameSession = 'lockGameSession',
    UnlockGameSession = 'unlockGameSession',
}
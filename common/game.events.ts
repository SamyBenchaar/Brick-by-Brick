export enum GameEvents {
    RequestGameList = 'requestGameList',
    RequestVisibleGameList = 'requestVisibleGameList',
    GameCreated = 'gameCreated',
    GameUpdated = 'gameUpdated',
    GameDeleted = 'gameDeleted',
    GameList = 'gameList',
    RequestMove = 'requestMove',
    JoinGameSession = "joinGameSession",
    PlayerAbandoned = "playerAbandoned",
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
    AddVirtualPlayer = 'addVirtualPlayer',

    KickPlayer = 'kickPlayer',
    PlayerKicked = 'playerKicked',
    RoomCancelled = 'roomCancelled',

    StartGame = 'startGame',
    GameStarted = 'gameStarted',

    ToggleDebugMode = 'toggleDebugMode',

    GameSessionStarted = 'gameSessionStarted',
    PlayerJoined = 'playerJoined',
    PlayerLeft = 'playerLeft',

    TurnStarting = 'turnStarting',
    TurnStarted = 'turnStarted',
    TurnTimeUpdate = 'turnTimeUpdate',
    InterTurnTimeUpdate = 'interTurnTimeUpdate',
    TurnEnded = 'turnEnded',
    EndTurnRequest = 'endTurnRequest',

    RequestMove = 'requestMove',
    RequestAssignPosition = 'requestAssignPosition',
    MoveExecuted = 'moveExecuted',
    ReachableTiles = 'reachableTiles',

    RequestInteract = 'requestInteract',
    InteractResult = 'interactResult',

    RequestFlagTransfer = 'requestFlagTransfer',
    FlagTransferResponse = 'flagTransferResponse',

    PlayerAbandoned = 'playerAbandoned',
    GameEnded = 'gameEnded',

    RequestPlayerInfo = 'requestPlayerInfo',
    RequestTileInfo = 'requestTileInfo',
}

export enum ChatEvents {
    SendMessage = 'sendMessage',
    ReceiveMessage = 'receiveMessage',
    LoadChatHistory = 'loadChatHistory',
    ChatHistory = 'chatHistory',
    ClearChatHistory = 'clearChatHistory',
}

export enum LogEvents {
    ReceiveLogMessage = 'receiveLogMessage',
    LoadLogHistory = 'loadLogHistory',
    LogHistory = 'logHistory',
    ClearLogHistory = 'clearLogHistory',
}

export enum CombatEvents {
    RequestCombat = 'requestCombat',
    CombatResult = 'combatResult',
    CombatStarted = 'combatStarted',
    CombatTurnStarted = 'combatTurnStarted',
    CombatTurnTimeUpdate = 'combatTurnTimeUpdate',
    SubmitCombatPosture = 'submitCombatChoice',
    CombatPostureSubmitted = 'combatChoiceSubmitted',
    CombatRoundResolved = 'combatRoundResolved',
    CombatEnded = 'combatEnded',
    TurnResumed = 'turnResumed',
}
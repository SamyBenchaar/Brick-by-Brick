import { GameSession } from '@app/domain/game-session';
import { LogService } from '@app/services/log/log.service';
import { Character } from '@common/character';
import { Server } from 'socket.io';

export interface GamePlayHandlerContext {
    server: Server;
    logService: LogService;
    onGameEnd: (gameSession: GameSession, winner: Character | null) => void;
    onGameEndCanceled: (gameSession: GameSession) => void;
    onTurnEnd: (gameSession: GameSession) => void;
    emitReachableTiles: (gameSession: GameSession) => void;
    resumeTurn: (gameSession: GameSession) => void;

}

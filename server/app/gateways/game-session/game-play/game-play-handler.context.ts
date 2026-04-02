import { GameSession } from '@app/domain/game-session';
import { Character } from '@common/character';
import { Server } from 'socket.io';

export interface GamePlayHandlerContext {
    server: Server;
    onGameEnd: (gameSession: GameSession, winner: Character | null) => void;
    onTurnEnd: (gameSession: GameSession) => void;
    emitReachableTiles: (gameSession: GameSession) => void;
}

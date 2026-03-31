import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { GameSessionEvents } from '@common/game.events';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GamePlayCombatHandler {
    constructor(
        private readonly logger: Logger,
        private readonly gameSessionService: GameSessionService,
    ) {}

    handleRequestCombat(
        socket: Socket,
        payload: { roomId: string; defenderId: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return;
        }

        try {
            const result = this.gameSessionService.executeCombat(gameSession, payload.defenderId);

            context.server.to(payload.roomId).emit(GameSessionEvents.CombatResult, {
                winner: result.winner,
                loser: result.loser,
                attackerVictories: result.attackerVictories,
                defenderNewPosition: gameSession.players.find(p => p.character.id === payload.defenderId)?.character.position,
                remainingActions: currentPlayer.remainingActions,
                flagPosition: gameSession.gameMode === 'ctf' ? gameSession.getFlagPosition() : null,
                flagHolder: gameSession.gameMode === 'ctf' ? gameSession.getFlagHolder() : null,
            });

            if (gameSession.gameMode === 'ctf') {
                context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
            }

            context.emitReachableTiles(gameSession);
            const winner = this.gameSessionService.checkGameWinner(gameSession);
            if (winner) {
                context.onGameEnd(gameSession, winner);
                return;
            }

            if (result.loser === currentPlayer.id) {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            } else {
                if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                    this.gameSessionService.endCurrentTurn(gameSession);
                    context.onTurnEnd(gameSession);
                }
            }
        } catch (error) {
            this.logger.error(`Combat error: ${error.message}`);
        }
    }
}

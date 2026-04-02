import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
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

        if (!this.validateCombatRequest(currentPlayer, requestingPlayer)) {
            return;
        }

        try {
            this.executeCombatAndEmit(gameSession, payload.defenderId, currentPlayer, context);
        } catch (error) {
            this.logger.error(`Combat error: ${error.message}`);
        }
    }

    private validateCombatRequest(currentPlayer: Character | null, requestingPlayer: Player | undefined): boolean {
        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return false;
        }

        if ((currentPlayer.remainingActions ?? 0) <= 0) {
            return false;
        }

        return true;
    }

    private executeCombatAndEmit(
        gameSession: GameSession,
        defenderId: string,
        currentPlayer: Character,
        context: GamePlayHandlerContext,
    ): void {
        const result = this.gameSessionService.executeCombat(gameSession, defenderId);

        context.server.to(gameSession.roomId).emit(GameSessionEvents.CombatResult, {
            winner: result.winner,
            loser: result.loser,
            attackerVictories: result.attackerVictories,
            defenderNewPosition: gameSession.players.find(p => p.character.id === defenderId)?.character.position,
            remainingActions: currentPlayer.remainingActions,
            flagPosition: gameSession.gameMode === 'ctf' ? gameSession.getFlagPosition() : null,
            flagHolder: gameSession.gameMode === 'ctf' ? gameSession.getFlagHolder() : null,
        });

        const winnerPlayer = gameSession.players.find(p => p.character.id === result.winner)?.character;
        const loserPlayer = gameSession.players.find(p => p.character.id === result.loser)?.character;
        if (winnerPlayer && loserPlayer) {
            context.logService.log(gameSession.roomId, `Résultat du combat: ${winnerPlayer.name} a gagné contre ${loserPlayer.name}`);
        }

        if (gameSession.gameMode === 'ctf') {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
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
    }
}

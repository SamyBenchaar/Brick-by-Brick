import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { GameSessionEvents } from '@common/game.events';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GamePlayTurnHandler {
    private readonly toMllisecondsFactor = 1000;
    private readonly interTurnTime = 3;

    constructor(
        private readonly logger: Logger,
        private readonly gameSessionService: GameSessionService,
        private readonly turnManagementService: TurnManagementService,
    ) {}

    startGameTurn(
        gameSession: GameSession,
        context: GamePlayHandlerContext,
    ): void {
        const currentPlayer = gameSession.getCurrentPlayer();

        gameSession.isTurnStarting = true;
        gameSession.setCurrentInterTurnTime(this.interTurnTime);

        if (gameSession.gameMode === 'ctf') {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarting, {
            playerId: currentPlayer?.id,
            playerName: currentPlayer?.name,
            delay: gameSession.getCurrentInterTurnTime() * this.toMllisecondsFactor,
        });

        this.turnManagementService.startInterTurnCountdown(
            gameSession,
            gameSession.getCurrentInterTurnTime(),
            (timeRemaining) => {
                context.server.to(gameSession.roomId).emit(GameSessionEvents.InterTurnTimeUpdate, {
                    timeRemaining,
                });
            },
            () => {
                gameSession.isTurnStarting = false;

                this.gameSessionService.startCurrentTurn(
                    gameSession,
                    () => {
                        context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarted, {
                            playerId: currentPlayer?.id,
                            playerName: currentPlayer?.name,
                            turnTime: gameSession.getCurrentTurnTime(),
                            remainingMovement: currentPlayer?.remainingMovement,
                            remainingActions: currentPlayer?.remainingActions,
                        });
                        context.emitReachableTiles(gameSession);

                        if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                            this.gameSessionService.endCurrentTurn(gameSession);
                            context.onTurnEnd(gameSession);
                        }
                    },
                    (timeRemaining: number) => {
                        context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnTimeUpdate, {
                            timeRemaining,
                        });
                    },
                    () => {
                        context.onTurnEnd(gameSession);
                    },
                );
            },
        );
    }

    handleTurnEnd(
        gameSession: GameSession,
        context: GamePlayHandlerContext,
        onNewTurn: (gameSession: GameSession) => void,
    ): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnEnded, {
            playerId: currentPlayer?.id,
        });

        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) {
            context.onGameEnd(gameSession, winner);
            return;
        }

        if (gameSession.playerOrder.length === 1) {
            context.onGameEnd(gameSession, null);
            return;
        }

        if (gameSession.playerOrder.length === 0) {
            context.onGameEnd(gameSession, null);
            return;
        }

        onNewTurn(gameSession);
    }
}

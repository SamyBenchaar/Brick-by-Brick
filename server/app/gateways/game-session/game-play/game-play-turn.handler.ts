import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { GameSessionEvents } from '@common/game.events';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { GameModeValue } from '@common/constants/game-config-constants';

@Injectable()
export class GamePlayTurnHandler {
    private readonly toMllisecondsFactor = 1000;
    private readonly interTurnTime = 3;

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
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

        if (gameSession.gameMode === GameModeValue.Ctf) {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarting, {
            playerId: currentPlayer?.id,
            playerName: currentPlayer?.name,
            delay: gameSession.getCurrentInterTurnTime() * this.toMllisecondsFactor,
        });

        if (currentPlayer) {
            context.logService.log(gameSession.roomId, `Début de tour de ${currentPlayer.name}`);
        }

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

        if (currentPlayer?.id) {
            gameSession.rejectPendingFlagTransfersFromPlayer(currentPlayer.id);
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        const ctfWinner = this.gameSessionService.checkCtfFlagWinner(gameSession);
        if (ctfWinner) {
            context.onGameEnd(gameSession, ctfWinner);
            return;
        }

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

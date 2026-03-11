import { GameSession } from '@common/gameSession';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TurnManagementService {
    private logger = new Logger(TurnManagementService.name);
    private turnTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly randomOffset = 0.5;
    private readonly turnTimeInSeconds = 30;
    private readonly timerIntervalInMilliseconds = 1000;
    private readonly delayBeforeTurnStartInMilliseconds = 3000;


    establishTurnOrder(gameSession: GameSession): void {
        const players = gameSession.getCharacters();

        const sortedPlayers = [...players].sort((a, b) => {
            if (a.speed === b.speed) {
                return Math.random() - this.randomOffset;
            }
            return b.speed - a.speed;
        });

        const playerOrder = sortedPlayers.map(p => p.id);
        gameSession.setPlayerOrder(playerOrder);
        gameSession.setCurrentPlayerIndex(0);

        this.logger.log(`Turn order established: ${playerOrder.join(', ')}`);
    }

    getTurnTimeInSeconds(): number {
        return this.turnTimeInSeconds;
    }

    startTurnTimer(gameSession: GameSession, onTimeoutCallback: () => void, onTickCallback?: (timeRemaining: number) => void): void {
        const roomId = gameSession.roomId;

        if (this.turnTimers.has(roomId)) {
            clearInterval(this.turnTimers.get(roomId));
        }

        const timerInterval = setInterval(() => {
            gameSession.decrementTurnTime();
            const timeRemaining = gameSession.getCurrentTurnTime();

            // Call the tick callback with the current time
            if (onTickCallback) {
                onTickCallback(timeRemaining);
            }

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                this.turnTimers.delete(roomId);
                onTimeoutCallback();
            }
        }, this.timerIntervalInMilliseconds);

        this.turnTimers.set(roomId, timerInterval);
    }

    endTurn(gameSession: GameSession): void {
        const roomId = gameSession.roomId;

        if (this.turnTimers.has(roomId)) {
            clearInterval(this.turnTimers.get(roomId));
            this.turnTimers.delete(roomId);
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        if (currentPlayer) {
            currentPlayer.remainingMovement = currentPlayer.speed;
        }

        gameSession.advanceToNextPlayer();
    }

    isPlayerTurn(gameSession: GameSession, playerId: string): boolean {
        const currentPlayer = gameSession.getCurrentPlayer();
        return currentPlayer ? currentPlayer.id === playerId : false;
    }

    getTurnTimeRemaining(gameSession: GameSession): number {
        return gameSession.getCurrentTurnTime();
    }

    forceEndTurn(gameSession: GameSession): void {
        this.endTurn(gameSession);
    }

    cleanupTimers(roomId: string): void {
        if (this.turnTimers.has(roomId)) {
            clearInterval(this.turnTimers.get(roomId));
            this.turnTimers.delete(roomId);
        }
    }
    canPlayerAct(gameSession: GameSession, playerId: string): boolean {
        return this.isPlayerTurn(gameSession, playerId) && gameSession.getCurrentTurnTime() > 0;
    }
}

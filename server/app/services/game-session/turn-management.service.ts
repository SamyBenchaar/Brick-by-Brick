import { GameSession } from '@app/domain/game-session';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SanctuaryService } from './sanctuary.service';

@Injectable()
export class TurnManagementService {
    private logger = new Logger(TurnManagementService.name);
    private turnTimers: Map<string, NodeJS.Timeout> = new Map();
    @Inject() private sanctuaryService: SanctuaryService;

    private readonly randomOffset = 0.5;
    private readonly turnTimeInSeconds = 30;
    private readonly timerIntervalInMilliseconds = 1000;

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

    private createTimer(roomId: string, getValue: () => number, decrement: () => void, onTick: (value: number) => void,
        onFinish: () => void): void {

        this.clearTimer(roomId);
        onTick(getValue());

        const interval = setInterval(() => {
            decrement();
            const value = getValue();
            onTick(value);

            if (value <= 0) {
                this.clearTimer(roomId);
                onFinish();
            }
        }, this.timerIntervalInMilliseconds);

        this.turnTimers.set(roomId, interval);
    }

    startTurnTimer(gameSession: GameSession, onTimeoutCallback: () => void, onTickCallback?: (timeRemaining: number) => void): void {
        const roomId = gameSession.roomId;

        this.createTimer(roomId, () => gameSession.getCurrentTurnTime(),
            () => gameSession.decrementTurnTime(), (time) => onTickCallback?.(time), onTimeoutCallback);
    }

    startInterTurnCountdown(gameSession: GameSession, seconds: number, onTickCallback: (time: number) => void,
        onFinishCallback: () => void): void {
        let remaining = seconds;

        this.createTimer(gameSession.roomId, () => remaining, () => {
                remaining--;
                gameSession.setCurrentInterTurnTime(remaining);
            },onTickCallback, onFinishCallback);
    }

    endTurn(gameSession: GameSession): void {
        const roomId = gameSession.roomId;

        this.clearTimer(roomId);
        const currentPlayer = gameSession.getCurrentPlayer();
        if (currentPlayer) {
            currentPlayer.remainingMovement = currentPlayer.speed;
            currentPlayer.remainingActions = 1;
            if (currentPlayer.combatSanctuaryBonus !== undefined) {
                if (currentPlayer.hasCombatSanctuaryBonus) {
                    currentPlayer.hasCombatSanctuaryBonus = false;
                } else {
                    currentPlayer.attack -= currentPlayer.combatSanctuaryBonus;
                    currentPlayer.defense -= currentPlayer.combatSanctuaryBonus;
                    currentPlayer.combatSanctuaryBonus = undefined;
                }
            }
        }
        if (gameSession.mapCopy) {
            this.sanctuaryService.decrementCooldowns(gameSession.mapCopy.tiles);
        }
        gameSession.advanceToNextPlayer();
    }

    private clearTimer(roomId: string): void {
        const timer = this.turnTimers.get(roomId);
        if (timer) {
            clearInterval(timer);
            this.turnTimers.delete(roomId);
        }
    }

    cleanupTimers(roomId: string): void {
        this.clearTimer(roomId);
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

    canPlayerAct(gameSession: GameSession, playerId: string): boolean {
        return this.isPlayerTurn(gameSession, playerId) && gameSession.getCurrentTurnTime() > 0;
    }
}
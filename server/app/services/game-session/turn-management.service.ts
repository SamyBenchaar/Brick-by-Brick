import { GameSession } from '@app/domain/game-session';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SanctuaryService } from './sanctuary.service';

@Injectable()
export class TurnManagementService {
    private logger = new Logger(TurnManagementService.name);
    private turnTimers: Map<string, NodeJS.Timeout> = new Map();
    private combatTimers: Map<string, NodeJS.Timeout> = new Map();
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

    private createTimer(options: {
        roomId: string;
        timers: Map<string, NodeJS.Timeout>;
        clearTimer: (targetRoomId: string) => void;
        getValue: () => number;
        decrement: () => void;
        onTick: (value: number) => void;
        onFinish: () => void;
    }): void {
        const {
            roomId,
            timers,
            clearTimer,
            getValue,
            decrement,
            onTick,
            onFinish,
        } = options;

        clearTimer(roomId);
        onTick(getValue());

        const interval = setInterval(() => {
            decrement();
            const value = getValue();
            onTick(value);

            if (value <= 0) {
                clearTimer(roomId);
                onFinish();
            }
        }, this.timerIntervalInMilliseconds);

        timers.set(roomId, interval);
    }

    startTurnTimer(gameSession: GameSession, onTimeoutCallback: () => void, onTickCallback?: (timeRemaining: number) => void): void {
        const roomId = gameSession.roomId;

        this.createTimer({
            roomId,
            timers: this.turnTimers,
            clearTimer: (targetRoomId) => this.clearTurnTimer(targetRoomId),
            getValue: () => gameSession.getCurrentTurnTime(),
            decrement: () => gameSession.decrementTurnTime(),
            onTick: (time) => onTickCallback?.(time),
            onFinish: onTimeoutCallback,
        });
    }

    resumeTurnTimer(
        gameSession: GameSession,
        onTimeoutCallback: () => void,
        onTickCallback?: (timeRemaining: number) => void,
    ): void {
        const roomId = gameSession.roomId;

        this.clearTurnTimer(roomId);
        onTickCallback?.(gameSession.getCurrentTurnTime());

        const interval = setInterval(() => {
            gameSession.decrementTurnTime();
            const value = gameSession.getCurrentTurnTime();
            onTickCallback?.(value);

            if (value <= 0) {
                this.clearTurnTimer(roomId);
                onTimeoutCallback();
            }
        }, this.timerIntervalInMilliseconds);

        this.turnTimers.set(roomId, interval);
    }

    startCombatTimer(
        gameSession: GameSession,
        onTimeoutCallback: () => void,
        onTickCallback?: (timeRemaining: number) => void,
    ): void {
        const roomId = gameSession.roomId;

        this.clearCombatTimer(roomId);
        onTickCallback?.(gameSession.getCurrentCombatTurnTime());

        const interval = setInterval(() => {
            gameSession.decrementCombatTurnTime();
            const value = gameSession.getCurrentCombatTurnTime();
            onTickCallback?.(value);

            if (value <= 0) {
                this.clearCombatTimer(roomId);
                onTimeoutCallback();
            }
        }, this.timerIntervalInMilliseconds);

        this.combatTimers.set(roomId, interval);
    }

    startInterTurnCountdown(gameSession: GameSession, seconds: number, onTickCallback: (time: number) => void,
        onFinishCallback: () => void): void {
        let remaining = seconds;

        this.createTimer({
            roomId: gameSession.roomId,
            timers: this.turnTimers,
            clearTimer: (targetRoomId) => this.clearTurnTimer(targetRoomId),
            getValue: () => remaining,
            decrement: () => {
                remaining--;
                gameSession.setCurrentInterTurnTime(remaining);
            },
            onTick: onTickCallback,
            onFinish: onFinishCallback,
        });
    }

    endTurn(gameSession: GameSession): void {
        const roomId = gameSession.roomId;

        this.clearTurnTimer(roomId);
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
        gameSession.totalTurns++;
        gameSession.advanceToNextPlayer();
    }

    private clearTurnTimer(roomId: string): void {
        const timer = this.turnTimers.get(roomId);
        if (timer) {
            clearInterval(timer);
            this.turnTimers.delete(roomId);
        }
    }

    private clearCombatTimer(roomId: string): void {
        const timer = this.combatTimers.get(roomId);
        if (timer) {
            clearInterval(timer);
            this.combatTimers.delete(roomId);
        }
    }

    pauseTurnTimer(roomId: string): void {
        this.clearTurnTimer(roomId);
    }

    stopCombatTimer(roomId: string): void {
        this.clearCombatTimer(roomId);
    }

    cleanupTimers(roomId: string): void {
        this.clearTurnTimer(roomId);
        this.clearCombatTimer(roomId);
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
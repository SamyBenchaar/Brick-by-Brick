import { Injectable, Injector, WritableSignal, computed, inject, signal } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { CombatPosture, CombatState } from '@common/combat';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';
import { GameSessionSocketService } from './game-session-socket.service';

@Injectable({
    providedIn: 'root',
})
export class GamePlaySocketService {
    private socketService = inject(SocketService);
    private injector = inject(Injector);

    private get gameSessionSocketService(): GameSessionSocketService {
        return this.injector.get(GameSessionSocketService);
    }

    playerSocketId: WritableSignal<string | null> = signal<string | null>(null);
    isDebugModeActivated: WritableSignal<boolean> = signal<boolean>(false);
    currentPlayerTurn: WritableSignal<string | null> = signal<string | null>(null);
    mapCopy: WritableSignal<Game | null> = signal<Game | null>(null);
    gameEnded: WritableSignal<boolean> = signal<boolean>(false);
    turnStarting: WritableSignal<boolean> = signal<boolean>(false);
    turnTimeRemaining: WritableSignal<number> = signal<number>(0);
    interTurnTimeRemaining: WritableSignal<number> = signal<number>(0);
    reachableTiles: WritableSignal<Position[]> = signal<Position[]>([]);
    combatState: WritableSignal<CombatState | null> = signal<CombatState | null>(null);
    combatNotification: WritableSignal<string | null> = signal<string | null>(null);

    combatParticipantIds = computed(() => {
        const combat = this.combatState();
        return combat ? [combat.attacker.id, combat.defender.id] : [];
    });

    connect(): void {
        if (!this.socketService.isConnected()) {
            this.socketService.connect();
        }
    }

    disconnect(): void {
        this.socketService.off(GameSessionEvents.ToggleDebugMode);
        this.socketService.off(GameSessionEvents.ReachableTiles);
        this.socketService.off(GameSessionEvents.TurnStarting);
        this.socketService.off(GameSessionEvents.TurnTimeUpdate);
        this.socketService.off(GameSessionEvents.TurnStarted);
        this.socketService.off(GameSessionEvents.TurnEnded);
        this.socketService.off(GameSessionEvents.MoveExecuted);
        this.socketService.off(GameSessionEvents.CombatStarted);
        this.socketService.off(GameSessionEvents.CombatUpdated);
        this.socketService.off(GameSessionEvents.CombatResult);
        this.socketService.off(GameSessionEvents.CombatChoosePosture);
    }

    resetGameplayState(): void {
        this.currentPlayerTurn.set(null);
        this.turnTimeRemaining.set(0);
        this.interTurnTimeRemaining.set(0);
        this.reachableTiles.set([]);
        this.gameEnded.set(false);
        this.turnStarting.set(false);
        this.isDebugModeActivated.set(false);
        this.mapCopy.set(null);
        this.combatState.set(null);
        this.combatNotification.set(null);
    }

    toggleDebugMode(): void {
        if (!this.isCurrentUserHost()) {
            return;
        }

        const currentRoomId = this.gameSessionSocketService.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.ToggleDebugMode, { currentRoomId });
        }
    }

    requestMove(direction: string): void {
        const currentRoomId = this.gameSessionSocketService.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestMove, { roomId: currentRoomId, direction });
        }
    }

    requestAssignPosition(position: Position): void {
        if (!this.isMyTurn() || !this.isDebugModeActivated()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestAssignPosition, { roomId: currentRoomId, position });
        }
    }

    requestCombat(defenderId: string): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestCombat, { roomId: currentRoomId, defenderId });
        }
    }

    chooseCombatPosture(posture: CombatPosture): void {
        const roomId = this.getRoomId();
        if (roomId) this.socketService.emit(GameSessionEvents.CombatChoosePosture, { roomId, posture });
    }

    endTurn(): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.EndTurnRequest, { roomId: currentRoomId });
        }
    }

    isMyTurn(): boolean {
        const currentPlayerId = this.currentPlayerTurn();
        if (!currentPlayerId) return false;
        const mySocketId = this.getSocketId();
        const myPlayer = this.currentSession()?.players.find(p => p.socketId === mySocketId);
        return myPlayer?.character.id === currentPlayerId;
    }

    getCurrentPlayerCharacter(): Character | null {
        const mySocketId = this.getSocketId();
        return this.currentSession()?.players.find(p => p.socketId === mySocketId)?.character ?? null;
    }

    getAutoAttackTarget(): Character | null {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!currentPlayer?.position) {
            return null;
        }

        const session = this.currentSession();
        if (!session) {
            return null;
        }

        return session.players
            .map(player => player.character)
            .find(character =>
                character.id !== currentPlayer.id && character.position !== undefined &&
                this.areAdjacent(currentPlayer.position as Position, character.position),
            ) ?? null;
    }

    canAttackTarget(target: Character | null): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();

        return (
            this.isMyTurn() && !this.combatState() && currentPlayer?.position !== undefined &&
            target?.position !== undefined && target.id !== currentPlayer.id &&
            currentPlayer.remainingActions !== undefined && currentPlayer.remainingActions > 0 &&
            this.areAdjacent(currentPlayer.position, target.position)
        );
    }

    canCurrentPlayerAttack(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        return this.isMyTurn() && !this.combatState() && currentPlayer?.position != null && currentPlayer.remainingActions != null &&
            currentPlayer.remainingActions > 0 && this.getAutoAttackTarget() !== null;
    }

    isCurrentUserInCombat(): boolean {
        const myId = this.getCurrentPlayerCharacter()?.id;
        return !!myId && this.combatParticipantIds().includes(myId);
    }

    isMyCombatTurn(): boolean {
        const myId = this.getCurrentPlayerCharacter()?.id;
        const combat = this.combatState();
        if (!myId || !combat) return false;

        const me =
            combat.attacker.id === myId
                ? combat.attacker
                : combat.defender.id === myId
                    ? combat.defender
                    : null;

        return !!me && !me.hasChosen;
    }

    dismissCombatNotification(): void {
        this.combatNotification.set(null);
    }

    private areAdjacent(positionA: Position, positionB: Position): boolean {
        return Math.abs(positionA.x - positionB.x) + Math.abs(positionA.y - positionB.y) === 1;
    }
    getRoomId(): string | undefined {
        return this.gameSessionSocketService.getRoomId();
    }

    getSocketId(): string {
        return this.gameSessionSocketService.getSocketId();
    }

    currentSession() {
        return this.gameSessionSocketService.currentSession();
    }

    isCurrentUserHost(): boolean {
        return this.gameSessionSocketService.isCurrentUserHost();
    }
}
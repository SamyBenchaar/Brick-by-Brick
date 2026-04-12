import { Injectable, Injector, WritableSignal, inject, signal } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { CombatSocketService } from './combat-socket.service';
import {
    areAdjacent,
    canAttackTarget,
    canCurrentPlayerAttack,
    canInteractWithTarget,
    canPlayerInteractDoor,
    canPlayerInteractSanctuary,
    canTransferFlagTo,
} from './game-play-rules.utils';
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

    private get gameSession(): GameSession | null {
        return this.gameSessionSocketService.currentSession();
    }

    private get combatSocketService(): CombatSocketService {
        return this.injector.get(CombatSocketService);
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
    pendingFlagTransfers: Map<string, unknown> = new Map();
    pendingFlagTransferTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

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
        this.socketService.off(CombatEvents.CombatResult);
    }

    resetGameplayState(): void {
        this.currentPlayerTurn.set(null);
        this.turnTimeRemaining.set(0);
        this.reachableTiles.set([]);
        this.gameEnded.set(false);
        this.turnStarting.set(false);
        this.isDebugModeActivated.set(false);
        this.mapCopy.set(null);
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
        if (this.combatSocketService.activeCombat()) {
            return;
        }

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
        if (this.combatSocketService.activeCombat()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(CombatEvents.RequestCombat, { roomId: currentRoomId, defenderId });
        }
    }

    chooseCombatPosture(posture: string): void {
        const roomId = this.getRoomId();
        if (roomId) this.socketService.emit(CombatEvents.SubmitCombatPosture, { roomId, posture });
    }


    requestFlagTransfer(toPlayerId: string): void {
        if (this.combatSocketService.activeCombat()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestFlagTransfer, { roomId: currentRoomId, toPlayerId });
        }
    }

    requestInteract(position: Position, mode: string): void {
        if (this.combatSocketService.activeCombat()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestInteract, { roomId: currentRoomId, position, mode });
        }
    }

    endTurn(): void {
        if (this.combatSocketService.activeCombat()) {
            return;
        }

        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.EndTurnRequest, { roomId: currentRoomId });
        }
    }

    isMyTurn(): boolean {
        const currentPlayerId = this.currentPlayerTurn();
        if (!currentPlayerId) return false;
        const mySocketId = this.getSocketId();
        const myPlayer = this.currentSession()?.players.find((p: Player) => p.socketId === mySocketId);
        return myPlayer?.character.id === currentPlayerId;
    }

    getCurrentPlayerCharacter(): Character | null {
        const mySocketId = this.getSocketId();
        return this.currentSession()?.players.find((p: Player) => p.socketId === mySocketId)?.character ?? null;
    }

    getCharacter(characterId: string): Character | null {
        const session = this.currentSession();
        if (!session) return null;
        return session.players.find((p: Player) => p.character.id === characterId)?.character ?? null;
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
            .map((player: Player) => player.character)
            .find((character: Character) =>
                character.id !== currentPlayer.id && !!character.position &&
                areAdjacent(currentPlayer.position as Position, character.position),
            ) ?? null;
    }

    canInteractWithTarget(target: Tile, position: Position): boolean {
        return canInteractWithTarget(
            !!this.combatSocketService.activeCombat(),
            this.isMyTurn(),
            this.getCurrentPlayerCharacter(),
            target,
            position,
            this.mapCopy(),
            this.gameSession,
        );
    }

    canPlayerInteractSanctuary(): boolean {
        return canPlayerInteractSanctuary(
            !!this.combatSocketService.activeCombat(),
            this.isMyTurn(),
            this.getCurrentPlayerCharacter(),
            this.mapCopy(),
        );
    }

    canPlayerInteractDoor(): boolean {
        return canPlayerInteractDoor(
            !!this.combatSocketService.activeCombat(),
            this.isMyTurn(),
            this.getCurrentPlayerCharacter(),
            this.mapCopy(),
            this.gameSession,
        );
    }

    canAttackTarget(target: Character | null): boolean {
        return canAttackTarget(
            !!this.combatSocketService.activeCombat(),
            this.isMyTurn(),
            this.getCurrentPlayerCharacter(),
            target,
        );
    }

    canCurrentPlayerAttack(): boolean {
        return canCurrentPlayerAttack(
            !!this.combatSocketService.activeCombat(),
            this.isMyTurn(),
            this.getCurrentPlayerCharacter(),
            this.getAutoAttackTarget() !== null,
        );
    }

    canTransferFlagTo(target: Character | null): boolean {
        return canTransferFlagTo(
            !!this.combatSocketService.activeCombat(),
            this.currentSession()?.gameMode,
            this.isMyTurn(),
            this.getCurrentPlayerCharacter(),
            target,
        );
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

    get currentSessionSignal(): WritableSignal<unknown> {
        return this.gameSessionSocketService.currentSession;
    }

    isCurrentUserHost(): boolean {
        return this.gameSessionSocketService.isCurrentUserHost();
    }

    setPendingFlagTransferDialog(toPlayerId: string, dialogRef: unknown, fromPlayerId: string): void {
        this.pendingFlagTransfers.set(toPlayerId, { dialogRef, fromPlayerId });
    }

    removePendingFlagTransferDialog(toPlayerId: string): void {
        this.pendingFlagTransfers.delete(toPlayerId);
    }

    clearPendingFlagTransfer(playerId: string): void {
        const timeoutId = this.pendingFlagTransferTimeouts.get(playerId);
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            this.pendingFlagTransferTimeouts.delete(playerId);
        }
    }

    clearAllPendingFlagTransfers(): void {
        this.pendingFlagTransferTimeouts.forEach((timeout) => {
            clearTimeout(timeout);
        });
        this.pendingFlagTransferTimeouts.clear();
        this.pendingFlagTransfers.clear();
    }

    setPendingFlagTransferTimeout(fromPlayerId: string, timeoutId: ReturnType<typeof setTimeout>): void {
        this.pendingFlagTransferTimeouts.set(fromPlayerId, timeoutId);
    }

    respondToFlagTransfer(fromPlayerId: string, accepted: boolean): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.FlagTransferResponse, {
                roomId: currentRoomId,
                fromPlayerId,
                accepted,
            });
        }
    }
}
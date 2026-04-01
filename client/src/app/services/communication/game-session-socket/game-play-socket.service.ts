import { Injectable, Injector, WritableSignal, inject, signal } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { Game } from '@app/interfaces/game';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { ObjectType, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { GameSessionSocketService } from './game-session-socket.service';
import { ADJACENT_POSITIONS } from '@app/constants/adjacent-position';
import { GameSession } from '@app/interfaces/game-session';

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
        this.socketService.off(GameSessionEvents.CombatResult);
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

    requestInteract(position: Position): void {
        const currentRoomId = this.getRoomId();
        if (currentRoomId) {
            this.socketService.emit(GameSessionEvents.RequestInteract, { roomId: currentRoomId, position });
        }
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
        const myPlayer = this.currentSession()?.players.find((p: Player) => p.socketId === mySocketId);
        return myPlayer?.character.id === currentPlayerId;
    }

    getCurrentPlayerCharacter(): Character | null {
        const mySocketId = this.getSocketId();
        return this.currentSession()?.players.find((p: Player) => p.socketId === mySocketId)?.character ?? null;
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
                character.id !== currentPlayer.id && character.position !== undefined &&
                this.areAdjacent(currentPlayer.position as Position, character.position),
            ) ?? null;
    }

    isFlagOnPosition(position: Position): boolean {
        return this.gameSession?.flagPosition?.x === position.x && this.gameSession?.flagPosition?.y === position.y;
    }
    
    canInteractWithTarget(target: Tile, position: Position): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        const playerPosition = currentPlayer?.position;
        if (!this.isMyTurn() || !playerPosition || (currentPlayer.remainingActions ?? 0) <= 0) return false;

        if (target.type === TileType.Door) {
            return this.areAdjacent(playerPosition, position) && !this.isFlagOnPosition(position);
        }

        if (target.object === ObjectType.HealingSanctuary || target.object === ObjectType.CombatSanctuary) {
            const origin = target.sanctuaryOrigin ?? position;
            return [[0, 0], [1, 0], [0, 1], [1, 1]].some(([dx, dy]) =>
                this.areAdjacent(playerPosition, { x: origin.x + dx, y: origin.y + dy }),
            );
        }

        return false;
    }

    canPlayerInteractSanctuary(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!this.isMyTurn() || !currentPlayer?.position || (currentPlayer.remainingActions ?? 0) <= 0) return false;
        const map = this.mapCopy();
        if (!map) return false;
        const { x, y } = currentPlayer.position;
        return ADJACENT_POSITIONS.some(offset => {
            const tile = map.mapConfig.tiles[y + offset.y]?.[x + offset.x];
            return tile?.object?.type === ObjectType.HealingSanctuary|| tile?.object?.type === ObjectType.CombatSanctuary;
        });
    }

    canPlayerInteractDoor(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!this.isMyTurn() || !currentPlayer?.position || (currentPlayer.remainingActions ?? 0) <= 0) return false;
        const map = this.mapCopy();
        if (!map) return false;
        if (this.areAdjacent(currentPlayer.position,
             {x: this.gameSession?.flagPosition?.x ?? 0, y: this.gameSession?.flagPosition?.y ?? 0})) return false;
        const { x, y } = currentPlayer.position;
        return ADJACENT_POSITIONS.some(offset => map.mapConfig.tiles[y + offset.y]?.[x + offset.x]?.type === 'door');
    }

    canAttackTarget(target: Character | null): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();

        return (
            this.isMyTurn() && currentPlayer?.position !== undefined &&
            target?.position !== undefined && target.id !== currentPlayer.id &&
            currentPlayer.remainingActions !== undefined && currentPlayer.remainingActions > 0 &&
            this.areAdjacent(currentPlayer.position, target.position)
        );
    }

    canCurrentPlayerAttack(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        return this.isMyTurn() && currentPlayer?.position != null && currentPlayer.remainingActions != null &&
            currentPlayer.remainingActions > 0 && this.getAutoAttackTarget() !== null;
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
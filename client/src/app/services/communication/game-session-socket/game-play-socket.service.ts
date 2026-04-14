import { Injectable, Injector, WritableSignal, inject, signal } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { ADJACENT_POSITIONS, ADJACENT_TO_ORIGIN_POSITION, ORIGIN_CANDIDATES, SANCTUARY_TILE_OFFSETS } from '@common/constants/santuary-constants';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { ObjectType, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { CombatSocketService } from './combat-socket.service';
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
        if (this.isCurrentUserHost()) {
            const currentRoomId = this.gameSessionSocketService.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(GameSessionEvents.ToggleDebugMode, { currentRoomId });
            }
        }
    }
    requestMove(direction: string): void {
        if (!this.combatSocketService.activeCombat()) {
            const currentRoomId = this.gameSessionSocketService.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(GameSessionEvents.RequestMove, { roomId: currentRoomId, direction });
            }
        }
    }
    requestAssignPosition(position: Position): void {
        if (this.isMyTurn() && this.isDebugModeActivated()) {
            const currentRoomId = this.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(GameSessionEvents.RequestAssignPosition, { roomId: currentRoomId, position });
            }
        }
    }
    requestCombat(defenderId: string): void {
        if (!this.combatSocketService.activeCombat()) {
            const currentRoomId = this.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(CombatEvents.RequestCombat, { roomId: currentRoomId, defenderId });
            }
        }
    }

    chooseCombatPosture(posture: string): void {
        const roomId = this.getRoomId();
        if (roomId) this.socketService.emit(CombatEvents.SubmitCombatPosture, { roomId, posture });
    }

    requestFlagTransfer(toPlayerId: string): void {
        if (!this.combatSocketService.activeCombat()) {
            const currentRoomId = this.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(GameSessionEvents.RequestFlagTransfer, { roomId: currentRoomId, toPlayerId });
            }
        }
    }

    requestInteract(position: Position, mode: string): void {
        if (!this.combatSocketService.activeCombat()) {
            const currentRoomId = this.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(GameSessionEvents.RequestInteract, { roomId: currentRoomId, position, mode });
            }
        }
    }

    endTurn(): void {
        if (!this.combatSocketService.activeCombat()) {
            const currentRoomId = this.getRoomId();
            if (currentRoomId) {
                this.socketService.emit(GameSessionEvents.EndTurnRequest, { roomId: currentRoomId });
            }
        }
    }

    isMyTurn(): boolean {
        const currentPlayerId = this.currentPlayerTurn();
        if (!currentPlayerId) return false;
        const mySocketId = this.getSocketId();
        const myPlayer = this.currentSession()?.players.find((p: Player) => p.socketId === mySocketId);
        return myPlayer?.character.id === currentPlayerId;
    }

    private canCurrentPlayerAct(): boolean {
        const player = this.getCurrentPlayerCharacter();
        return (this.isMyTurn() && (player?.remainingActions ?? 0) > 0 && !this.combatSocketService.activeCombat());
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

    private isEnemyTarget(currentPlayer: Character, target: Character): boolean {
        const session = this.currentSession();
        if (session?.gameMode !== 'ctf') {
            return true;
        }

        if (!currentPlayer.team || !target.team) {
            return true;
        }

        return currentPlayer.team !== target.team;
    }

    private canCharacterAttackTarget(currentPlayer: Character, target: Character): boolean {
        const hasAction = (currentPlayer.remainingActions ?? 0) > 0;
        const currentPlayerPosition = currentPlayer.position;
        const targetPosition = target.position;
        const isDifferentCharacter = currentPlayer.id !== target.id;

        if (!hasAction || !currentPlayerPosition || !targetPosition || !isDifferentCharacter) {
            return false;
        }

        return this.areAdjacent(currentPlayerPosition, targetPosition) && this.isEnemyTarget(currentPlayer, target);
    }

    getAutoAttackTarget(): Character | null {
        const currentPlayer = this.getCurrentPlayerCharacter();
        const session = this.currentSession();
        if (!currentPlayer?.position || !session) {
            return null;
        }

        return session.players
            .map((player: Player) => player.character)
            .find((target: Character) => this.canCharacterAttackTarget(currentPlayer, target)) ?? null;
    }

    isFlagOnPosition(position: Position): boolean {
        return this.gameSession?.flagPosition?.x === position.x && this.gameSession?.flagPosition?.y === position.y;
    }

    canInteractWithTarget(target: Tile, position: Position): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        const playerPosition = currentPlayer?.position;
        if (!playerPosition || !this.canCurrentPlayerAct()) return false;

        if (target.type === TileType.Door) {
            return this.areAdjacent(playerPosition, position) && !this.isFlagOnPosition(position);
        }

        if (target.object === ObjectType.HealingSanctuary || target.object === ObjectType.CombatSanctuary) {
            return this.canInteractWithSanctuary(currentPlayer, playerPosition, target, position);
        }
        return false;
    }

    private findSanctuaryOrigin(position: Position): Position | undefined {
        const tiles = this.mapCopy()?.mapConfig.tiles;
        if (!tiles) return undefined;
        return ORIGIN_CANDIDATES
            .map(({ dx, dy }) => ({ x: position.x + dx, y: position.y + dy }))
            .find(candidate =>
                SANCTUARY_TILE_OFFSETS.every(({ dx, dy }) => {
                    const t = tiles[candidate.y + dy]?.[candidate.x + dx];
                    return t?.object?.type === ObjectType.HealingSanctuary || t?.object?.type === ObjectType.CombatSanctuary;
                }),
            );
    }

    private canInteractWithSanctuary(player: Character, playerPosition: Position, target: Tile, position: Position): boolean {
        if (player.combatSanctuaryBonus !== undefined && target.object === ObjectType.CombatSanctuary) return false;
        const originPos = this.findSanctuaryOrigin(position);
        if (!originPos) return false;
        const originTile = this.mapCopy()?.mapConfig.tiles[originPos.y]?.[originPos.x];
        if ((originTile?.sanctuaryCooldown ?? 0) > 0) return false;
        return ADJACENT_TO_ORIGIN_POSITION.some(([dx, dy]) =>
            this.areAdjacent(playerPosition, { x: originPos.x + dx, y: originPos.y + dy }),
        );
    }

    canPlayerInteractSanctuary(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        const hasBonus = (currentPlayer?.combatSanctuaryBonus !== undefined);
        if (!currentPlayer?.position || !this.canCurrentPlayerAct()) return false;
        const map = this.mapCopy();
        if (!map) return false;
        const { x, y } = currentPlayer.position;
        return ADJACENT_POSITIONS.some(offset => {
            const tileX = x + offset.x;
            const tileY = y + offset.y;
            const tile = map.mapConfig.tiles[tileY]?.[tileX];
            const isSanctuary = this.isSanctuary(tile?.object?.type);
            if (hasBonus && isSanctuary) return false;
            if (!isSanctuary) return false;
            const originPos = this.findSanctuaryOrigin({ x: tileX, y: tileY });
            if (!originPos) return false;
            return (map.mapConfig.tiles[originPos.y]?.[originPos.x]?.sanctuaryCooldown ?? 0) === 0;
        });
    }

    isSanctuary(object: string | undefined): boolean {
        return object === ObjectType.HealingSanctuary
            || object === ObjectType.CombatSanctuary;
    }

    canPlayerInteractDoor(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!currentPlayer?.position || !this.canCurrentPlayerAct()) return false;
        const map = this.mapCopy();
        if (!map) return false;
        if (this.areAdjacent(currentPlayer.position,
            { x: this.gameSession?.flagPosition?.x ?? 0, y: this.gameSession?.flagPosition?.y ?? 0 })) return false;
        const { x, y } = currentPlayer.position;
        return ADJACENT_POSITIONS.some(offset => map.mapConfig.tiles[y + offset.y]?.[x + offset.x]?.type === 'door');
    }

    canAttackTarget(target: Character | null): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!this.canCurrentPlayerAct() || !currentPlayer || !target) {
            return false;
        }
        return this.canCharacterAttackTarget(currentPlayer, target);
    }

    canCurrentPlayerAttack(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        return this.canCurrentPlayerAct() && currentPlayer?.position != null
        && this.getAutoAttackTarget() !== null;
    }

    canTransferFlagTo(target: Character | null): boolean {
        if (this.currentSession()?.gameMode !== 'ctf') return false;
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!currentPlayer || !target) return false;

        const canTransfer = (currentPlayer.hasFlag === true && target.hasFlag === false) || 
            (currentPlayer.hasFlag === false && target.hasFlag === true);

        return (
            canTransfer &&
            this.canCurrentPlayerAct() &&
            this.isValidFlagTransferTarget(currentPlayer, target)
        );
    }

    canRequestFlagFrom(targetcharacter: Character): boolean {
        if (this.currentSession()?.gameMode !== 'ctf') return false;
    
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!currentPlayer) return false;

        const hasValidFlagState  =
            !currentPlayer.hasFlag &&
            !!targetcharacter.hasFlag;

        return (hasValidFlagState &&
            this.canCurrentPlayerAct() &&
            this.isValidFlagTransferTarget(currentPlayer, targetcharacter));
    }

    private isValidFlagTransferTarget(currentPlayer: Character, target: Character): boolean {
        if (currentPlayer.position === undefined || target.position === undefined) {
            return false;
        }
        if (target.id === currentPlayer.id || currentPlayer.team !== target.team) {
            return false;
        }

        if (!this.areAdjacent(currentPlayer.position, target.position)) {
            return false;
        }
        return true;
    }

    canPlayerInteractFlag(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!this.canCurrentPlayerAct() || !currentPlayer) {
            return false;
        }

        const session = this.currentSession();
        if (!session) return false;

        return session.players.some(player => {
            const character = player.character;
            return character.id !== currentPlayer.id && this.canTransferFlagTo(character) || this.canRequestFlagFrom(character);
        });
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
                roomId: currentRoomId, fromPlayerId, accepted,
            });
        }
    }
}
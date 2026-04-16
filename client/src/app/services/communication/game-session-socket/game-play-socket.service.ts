import { Injectable, Injector, WritableSignal, inject, signal } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { CombatActionRulesService } from './combat-action-rules.service';
import { CombatSocketService } from './combat-socket.service';
import { FlagActionRulesService } from './flag-action-rules.service';
import { FlagTransferStateService } from './flag-transfer-state.service';
import { CombatPosture, InteractionMode } from '@app/interfaces/game-play';
import { GameSessionSocketService } from './game-session-socket.service';
import { InteractionActionRulesService } from './interaction-action-rules.service';
import { PlayerSessionQueryService } from './player-session-query.service';

@Injectable({
    providedIn: 'root',
})
export class GamePlaySocketService {
    private readonly socketService = inject(SocketService);
    private readonly injector = inject(Injector);
    private readonly flagTransferStateService = inject(FlagTransferStateService);
    private readonly playerSessionQueryService = inject(PlayerSessionQueryService);
    private readonly combatActionRulesService = inject(CombatActionRulesService);
    private readonly interactionActionRulesService = inject(InteractionActionRulesService);
    private readonly flagActionRulesService = inject(FlagActionRulesService);

    isDebugModeActivated: WritableSignal<boolean> = signal<boolean>(false);
    currentPlayerTurn: WritableSignal<string | null> = signal<string | null>(null);
    mapCopy: WritableSignal<Game | null> = signal<Game | null>(null);
    gameEnded: WritableSignal<boolean> = signal<boolean>(false);
    turnStarting: WritableSignal<boolean> = signal<boolean>(false);
    turnTimeRemaining: WritableSignal<number> = signal<number>(0);
    interTurnTimeRemaining: WritableSignal<number> = signal<number>(0);
    reachableTiles: WritableSignal<Position[]> = signal<Position[]>([]);

    private get gameSessionSocketService(): GameSessionSocketService {
        return this.injector.get(GameSessionSocketService);
    }

    private get combatSocketService(): CombatSocketService {
        return this.injector.get(CombatSocketService);
    }

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
        this.socketService.off(CombatEvents.CombatEnded);
        this.flagTransferStateService.clearAllPendingTransfers();
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
        this.flagTransferStateService.clearAllPendingTransfers();
    }

    toggleDebugMode(): void {
        if (!this.isCurrentUserHost()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.socketService.emit(GameSessionEvents.ToggleDebugMode, { currentRoomId: roomId });
        });
    }

    requestMove(direction: string): void {
        if (this.flagTransferStateService.hasAnyPendingTransfer() || this.hasActiveCombat()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.socketService.emit(GameSessionEvents.RequestMove, { roomId, direction });
        });
    }

    requestAssignPosition(position: Position): void {
        if (!this.isMyTurn() || !this.isDebugModeActivated()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.socketService.emit(GameSessionEvents.RequestAssignPosition, { roomId, position });
        });
    }

    requestCombat(defenderId: string): void {
        if (this.hasActiveCombat()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.socketService.emit(CombatEvents.RequestCombat, { roomId, defenderId });
        });
    }

    chooseCombatPosture(posture: CombatPosture): void {
        this.emitWithRoom((roomId) => {
            this.socketService.emit(CombatEvents.SubmitCombatPosture, { roomId, posture });
        });
    }

    requestFlagTransfer(toPlayerId: string): void {
        if (this.hasActiveCombat()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.flagTransferStateService.registerPendingTransfer(toPlayerId);
            this.socketService.emit(GameSessionEvents.RequestFlagTransfer, { roomId, toPlayerId });
        });
    }

    requestInteract(position: Position, mode: InteractionMode): void {
        if (this.hasActiveCombat()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.socketService.emit(GameSessionEvents.RequestInteract, { roomId, position, mode });
        });
    }

    endTurn(): void {
        if (this.hasActiveCombat()) {
            return;
        }

        this.emitWithRoom((roomId) => {
            this.socketService.emit(GameSessionEvents.EndTurnRequest, { roomId });
        });
    }

    isMyTurn(): boolean {
        const currentPlayerId = this.currentPlayerTurn();
        if (!currentPlayerId) {
            return false;
        }

        const mySocketId = this.getSocketId();
        const session = this.currentSession();
        const myPlayer = session?.players.find((player: Player) => player.socketId === mySocketId);

        return myPlayer?.character.id === currentPlayerId;
    }

    getCurrentPlayerCharacter(): Character | null {
        return this.playerSessionQueryService.getCurrentPlayerCharacter(this.currentSession(), this.getSocketId());
    }

    getCharacter(characterId: string): Character | null {
        return this.playerSessionQueryService.getCharacterById(this.currentSession(), characterId);
    }

    canInteractWithTarget(targetTile: Tile, position: Position): boolean {
        return this.interactionActionRulesService.canInteractWithTarget(
            {
                session: this.currentSession(),
                currentPlayer: this.getCurrentPlayerCharacter(),
                canAct: this.canCurrentPlayerAct(),
                mapCopy: this.mapCopy(),
            },
            targetTile,
            position,
        );
    }

    canPlayerInteractDoor(): boolean {
        return this.interactionActionRulesService.canPlayerInteractDoor(
            this.currentSession(),
            this.getCurrentPlayerCharacter(),
            this.canCurrentPlayerAct(),
            this.mapCopy(),
        );
    }

    canPlayerInteractSanctuary(): boolean {
        return this.interactionActionRulesService.canPlayerInteractSanctuary(
            this.getCurrentPlayerCharacter(),
            this.canCurrentPlayerAct(),
            this.mapCopy(),
        );
    }

    canAttackTarget(target: Character | null): boolean {
        return this.combatActionRulesService.canCharacterAttackTarget(
            this.currentSession(),
            this.getCurrentPlayerCharacter(),
            target,
        );
    }

    canCurrentPlayerAttack(): boolean {
        const currentPlayer = this.getCurrentPlayerCharacter();
        if (!currentPlayer?.position || !this.canCurrentPlayerAct(currentPlayer)) {
            return false;
        }

        return this.combatActionRulesService.getAutoAttackTarget(this.currentSession(), currentPlayer) !== null;
    }

    canTransferFlagTo(target: Character | null): boolean {
        return this.flagActionRulesService.canTransferFlagTo(
            this.currentSession(),
            this.getCurrentPlayerCharacter(),
            target,
            this.canCurrentPlayerAct(),
        );
    }

    canRequestFlagFrom(target: Character | null): boolean {
        return this.flagActionRulesService.canRequestFlagFrom(
            this.currentSession(),
            this.getCurrentPlayerCharacter(),
            target,
            this.canCurrentPlayerAct(),
        );
    }

    canPlayerInteractFlag(): boolean {
        return this.flagActionRulesService.canPlayerInteractFlag(
            this.currentSession(),
            this.getCurrentPlayerCharacter(),
            this.canCurrentPlayerAct(),
        );
    }

    getRoomId(): string | undefined {
        return this.gameSessionSocketService.getRoomId();
    }

    getSocketId(): string {
        return this.gameSessionSocketService.getSocketId();
    }

    currentSession(): GameSession | null {
        return this.gameSessionSocketService.currentSession();
    }

    get currentSessionSignal(): WritableSignal<GameSession | null> {
        return this.gameSessionSocketService.currentSession;
    }

    isCurrentUserHost(): boolean {
        return this.gameSessionSocketService.isCurrentUserHost();
    }

    respondToFlagTransfer(fromPlayerId: string, accepted: boolean): void {
        this.emitWithRoom((roomId) => {
            this.socketService.emit(GameSessionEvents.FlagTransferResponse, {
                roomId,
                fromPlayerId,
                accepted,
            });
        });

        this.clearPendingFlagTransferRequest(fromPlayerId);
    }

    clearPendingFlagTransferRequest(playerId: string): void {
        this.flagTransferStateService.clearPendingTransfer(playerId);
    }

    clearAllPendingFlagTransferRequests(): void {
        this.flagTransferStateService.clearAllPendingTransfers();
    }

    private hasActiveCombat(): boolean {
        return !!this.combatSocketService.activeCombat();
    }

    private emitWithRoom(action: (roomId: string) => void): void {
        const roomId = this.getRoomId();
        if (roomId) {
            action(roomId);
        }
    }

    private canCurrentPlayerAct(currentPlayer?: Character | null): boolean {
        return this.combatActionRulesService.canCurrentPlayerAct(
            currentPlayer ?? this.getCurrentPlayerCharacter(),
            this.isMyTurn(),
            this.hasActiveCombat(),
        );
    }
}

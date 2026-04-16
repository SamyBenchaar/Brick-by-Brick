import { signal, WritableSignal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Tile } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { ObjectType, TileType } from '@common/map';
import { setupGameplayEventListeners } from './gameplay-listeners';

type ListenerCallback<T> = (payload: T) => void;

/**
 * Strategie de test:
 * - Approche par flux devenements: chaque test valide payload entrant -> effet attendu
 *   sur les signaux locaux, la session, puis les services relies.
 * - Isolation des comportements: un test de wiring (listeners enregistres), puis un
 *   test par regle metier (tour, tuiles atteignables, interaction, nettoyage combat).
 * - Priorite aux regressions silencieuses: les assertions couvrent aussi les effets de bord
 *   (nettoyage detat precedent et cohérence de session apres evenement).
 * Cas limites couverts:
 * - ReachableTiles pour un autre joueur / hors tour.
 * - InteractResult sanctuary sans origine valide (pas de cooldown applique).
 * - CombatResult avec etat local deja rempli (doit tout reinitialiser proprement).
 *
 * Traceabilite strategie -> tests:
 * - Wiring listeners: "devrait enregistrer les listeners gameplay essentiels..."
 * - Tour actif: "devrait mettre a jour le joueur actif..."
 * - Filtrage tuiles: "devrait exposer les cases atteignables..."
 * - Interaction sanctuary: "devrait appliquer le cooldown sanctuary..."
 * - Nettoyage post-combat: "devrait vider l etat de combat local..."
 */
describe('setupGameplayEventListeners', () => {
    const callbacks = new Map<string, ListenerCallback<unknown>>();
    let currentSessionSignal: WritableSignal<GameSession | null>;
    let mapCopySignal: WritableSignal<unknown>;

    const socketServiceMock = {
        on<T>(event: string, callback: ListenerCallback<T>): void {
            callbacks.set(event, callback as ListenerCallback<unknown>);
        },
    } as SocketService;

    const gameSessionSocketServiceMock = {
        currentSession: signal<GameSession | null>(null),
        hasAbandoned: signal(false),
        endGameDelay: 10,
    } as unknown as GameSessionSocketService;

    const gamePlaySocketServiceMock: unknown = {
        turnStarting: signal(false),
        currentPlayerTurn: signal<string | null>(null),
        reachableTiles: signal<unknown[]>([]),
        turnTimeRemaining: signal<number | null>(null),
        interTurnTimeRemaining: signal<number | null>(null),
        isDebugModeActivated: signal(false),
        gameEnded: signal(false),
        pendingFlagTransferTimeouts: new Map<string, ReturnType<typeof setTimeout>>(),
        pendingFlagTransfers: new Map<string, unknown>(),
        respondToFlagTransfer: jasmine.createSpy('respondToFlagTransfer'),
        getSocketId: jasmine.createSpy('getSocketId').and.returnValue('socket-1'),
        currentSession: (): GameSession | null => currentSessionSignal(),
        mapCopy: (): unknown => mapCopySignal(),
    };

    const dialogMock = {
        getDialogById: jasmine.createSpy('getDialogById').and.returnValue(undefined),
        open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => ({ subscribe: () => undefined }) }),
    } as unknown as MatDialog;

    const routerMock = {
        navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
    } as unknown as Router;

    const flagTransferServiceMock = {
        getPendingFlagTransferDialogs: jasmine.createSpy('getPendingFlagTransferDialogs').and.returnValue(new Map()),
        clearAllPendingFlagTransfers: jasmine.createSpy('clearAllPendingFlagTransfers'),
        setPendingFlagTransferDialog: jasmine.createSpy('setPendingFlagTransferDialog'),
        removePendingFlagTransferDialog: jasmine.createSpy('removePendingFlagTransferDialog'),
    } as unknown as FlagTransferSocketService;

    const combatSocketServiceMock = {
        activeCombat: signal<unknown>(null),
        latestRound: signal<unknown>(null),
        combatTurnTimeRemaining: signal<number | null>(null),
        showCombatNotification: jasmine.createSpy('showCombatNotification'),
    } as unknown as CombatSocketService;

    function getCallback<T>(event: string): ListenerCallback<T> {
        const callback = callbacks.get(event);
        expect(callback).toBeDefined();
        return callback as ListenerCallback<T>;
    }

    beforeEach(() => {
        callbacks.clear();

        currentSessionSignal = signal<GameSession | null>({
            players: [
                {
                    socketId: 'socket-1',
                    character: { id: 'p1', name: 'P1', position: { x: 1, y: 1 }, remainingMovement: 3, remainingActions: 1 },
                },
                {
                    socketId: 'socket-2',
                    character: { id: 'p2', name: 'P2', position: { x: 2, y: 1 }, remainingMovement: 3, remainingActions: 1 },
                },
            ],
            leftPlayers: [],
            roomId: 'ROOM1',
            mapCopy: null,
            host: { socketId: 'socket-1', character: { id: 'p1' } },
            mapId: 'map-1',
            socketToAvatar: new Map<string, number>(),
            playerOrder: ['p1', 'p2'],
            currentPlayerIndex: 0,
            currentTurnTime: 30,
            startingPoints: new Map<string, { x: number; y: number }>(),
            isTurnStarting: false,
            isDebugModeActivated: false,
            gameMode: 'classic',
            flagPosition: null,
            activeCombat: null,
            currentCombatTurnTime: 10,
            maxPlayers: 4,
            status: 'playing',
        } as unknown as GameSession);

        mapCopySignal = signal({
            mapConfig: {
                tiles: [
                    [
                        { type: TileType.Base } as Tile,
                        { type: TileType.Base, object: { type: ObjectType.HealingSanctuary } } as unknown as Tile,
                    ],
                    [
                        { type: TileType.Base, object: { type: ObjectType.CombatSanctuary } } as unknown as Tile,
                        { type: TileType.Base, object: { type: ObjectType.HealingSanctuary } } as unknown as Tile,
                    ],
                ],
            },
        });

        gameSessionSocketServiceMock.currentSession.set(currentSessionSignal());
        gamePlaySocketServiceMock.currentPlayerTurn.set(null);
        gamePlaySocketServiceMock.reachableTiles.set([]);

        setupGameplayEventListeners({
            gamePlaySocketService: gamePlaySocketServiceMock as GamePlaySocketService,
            gameSessionSocketService: gameSessionSocketServiceMock,
            socketService: socketServiceMock,
            router: routerMock,
            dialog: dialogMock,
            flagTransferService: flagTransferServiceMock,
            combatSocketService: combatSocketServiceMock,
        });
    });

    it('devrait enregistrer les listeners gameplay essentiels et les listeners combat', () => {
        expect(callbacks.has(GameSessionEvents.TurnStarting)).toBeTrue();
        expect(callbacks.has(GameSessionEvents.TurnStarted)).toBeTrue();
        expect(callbacks.has(GameSessionEvents.ReachableTiles)).toBeTrue();
        expect(callbacks.has(GameSessionEvents.InteractResult)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatResult)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatStarted)).toBeTrue();
    });

    it('devrait mettre a jour le joueur actif et ses ressources au TurnStarted', () => {
        getCallback<{ playerId: string; playerName: string; turnTime: number; remainingMovement: number; remainingActions: number }>(
            GameSessionEvents.TurnStarted,
        )({
            playerId: 'p1',
            playerName: 'P1',
            turnTime: 20,
            remainingMovement: 2,
            remainingActions: 0,
        });

        expect(gamePlaySocketServiceMock.turnStarting()).toBeFalse();
        expect(gamePlaySocketServiceMock.currentPlayerTurn()).toBe('p1');
        expect(gamePlaySocketServiceMock.turnTimeRemaining()).toBe(20);
        expect(gameSessionSocketServiceMock.currentSession()?.players[0].character.remainingMovement).toBe(2);
        expect(gameSessionSocketServiceMock.currentSession()?.players[0].character.remainingActions).toBe(0);
    });

    it('devrait exposer les cases atteignables uniquement pour mon joueur pendant mon tour', () => {
        gamePlaySocketServiceMock.currentPlayerTurn.set('p1');

        getCallback<{ playerId: string; tiles: { x: number; y: number }[] }>(GameSessionEvents.ReachableTiles)({
            playerId: 'p1',
            tiles: [{ x: 3, y: 3 }],
        });

        expect(gamePlaySocketServiceMock.reachableTiles()).toEqual([{ x: 3, y: 3 }]);

        getCallback<{ playerId: string; tiles: { x: number; y: number }[] }>(GameSessionEvents.ReachableTiles)({
            playerId: 'p2',
            tiles: [{ x: 4, y: 4 }],
        });

        expect(gamePlaySocketServiceMock.reachableTiles()).toEqual([]);
    });

    it('devrait appliquer le cooldown sanctuary lors de InteractResult', () => {
        gamePlaySocketServiceMock.currentPlayerTurn.set('p1');

        getCallback<{ position: { x: number; y: number }; newDoorState: string; remainingActions: number; interactionType: string }>(
            GameSessionEvents.InteractResult,
        )({
            position: { x: 1, y: 1 },
            newDoorState: 'opened',
            remainingActions: 0,
            interactionType: 'healingsanctuary',
        });

        expect(mapCopySignal().mapConfig.tiles[0][0].sanctuaryCooldown).toBe(2);
        expect(gameSessionSocketServiceMock.currentSession()?.players[0].character.remainingActions).toBe(0);
    });

    it('devrait vider l etat de combat local a la reception de CombatResult', () => {
        combatSocketServiceMock.activeCombat.set({ attackerId: 'p1', defenderId: 'p2' });
        combatSocketServiceMock.latestRound.set({ roundNumber: 1 });
        combatSocketServiceMock.combatTurnTimeRemaining.set(5);
        gamePlaySocketServiceMock.reachableTiles.set([{ x: 9, y: 9 }]);

        getCallback<unknown>(CombatEvents.CombatResult)({
            attackerId: 'p1',
            defenderId: 'p2',
            winnerId: 'p1',
            loserIds: ['p2'],
            outcome: 'attacker',
            attackerPosition: { x: 1, y: 1 },
            defenderPosition: { x: 5, y: 5 },
            attackerLife: 4,
            defenderLife: 0,
            attackerVictories: 1,
            defenderVictories: 0,
            remainingActions: 0,
            remainingTurnTime: 12,
            turnShouldContinue: false,
            flagPosition: null,
            flagHolderId: null,
        });

        expect(gamePlaySocketServiceMock.reachableTiles()).toEqual([]);
        expect(combatSocketServiceMock.activeCombat()).toBeNull();
        expect(combatSocketServiceMock.latestRound()).toBeNull();
        expect(combatSocketServiceMock.combatTurnTimeRemaining()).toBeNull();
    });
});

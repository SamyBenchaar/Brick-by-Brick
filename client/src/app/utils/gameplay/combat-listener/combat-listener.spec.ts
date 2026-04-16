import { signal, WritableSignal } from '@angular/core';
import { GameSession } from '@app/interfaces/game-session';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { ActiveCombat, CombatRoundResolvedPayload } from '@common/combat';
import { Dice } from '@common/dice';
import { CombatEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { setupCombatListeners } from './combat-listener';

type ListenerCallback<T> = (payload: T) => void;

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;
const DEFAULT_REMAINING_MOVEMENT = 3;
const DEFAULT_REMAINING_ACTIONS = 1;
const DEFAULT_TURN_TIME = 10;
const DEFAULT_SESSION_TURN_TIME = 30;

function createCharacter(overrides: Partial<Character> = {}): Character {
    return {
        id: 'player-1',
        isActif: false,
        battlesWon: 0,
        name: 'Player',
        avatarId: 1,
        maxLife: DEFAULT_LIFE,
        life: DEFAULT_LIFE,
        speed: DEFAULT_SPEED,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
        movements: DEFAULT_MOVEMENTS,
        actions: DEFAULT_ACTIONS,
        attackDice: Dice.D4,
        defenseDice: Dice.D6,
        position: { x: 1, y: 1 },
        remainingMovement: DEFAULT_REMAINING_MOVEMENT,
        remainingActions: DEFAULT_REMAINING_ACTIONS,
        victories: 0,
        defeats: 0,
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        tilesVisited: 0,
        hasFlag: false,
        ...overrides,
    };
}

function createPlayer(socketId: string, character: Character): Player {
    return { socketId, character };
}

function createSession(players: Player[]): GameSession {
    return {
        players,
        leftPlayers: [],
        status: 'playing' as never,
        roomId: 'ROOM1',
        maxPlayers: 4,
        mapCopy: null,
        host: players[0],
        mapId: 'map-1',
        socketToAvatar: new Map<string, number>(),
        playerOrder: players.map((player) => player.character.id),
        currentPlayerIndex: 0,
        currentTurnTime: DEFAULT_SESSION_TURN_TIME,
        startingPoints: new Map<string, Position>(),
        isTurnStarting: false,
        isDebugModeActivated: false,
        gameMode: 'classic',
        flagPosition: null,
        activeCombat: null,
        currentCombatTurnTime: DEFAULT_TURN_TIME,
    };
}

/**
 * Strategie de test:
 * - Verifier le wiring de tous les evenements combat ecoutes par le client.
 * - Verifier les transitions detat round par round (start, timer, resolved, end).
 * - Verifier la coherence des signaux partages entre gameplay et combat.
 * Cas limites couverts:
 * - Reception dun round avec postures precedentes (elles doivent etre nettoyees).
 * - Fin de combat avec etat local pre-rempli (reset complet attendu).
 */
describe('setupCombatListeners', () => {
    const callbacks = new Map<string, ListenerCallback<unknown>>();
    let currentSessionSignal: WritableSignal<GameSession | null>;

    const socketServiceMock = {
        on<T>(event: string, callback: ListenerCallback<T>): void {
            callbacks.set(event, callback as ListenerCallback<unknown>);
        },
    } as SocketService;

    const reachableTilesSignal = signal<Position[]>([{ x: 9, y: 9 }]);

    const serviceMock = {
        reachableTiles: reachableTilesSignal,
        currentSession: (): GameSession | null => currentSessionSignal(),
    } as Pick<GamePlaySocketService, 'reachableTiles' | 'currentSession'>;

    const combatSocketServiceMock = {
        activeCombat: signal<ActiveCombat | null>(null),
        latestRound: signal<CombatRoundResolvedPayload | null>(null),
        combatTurnTimeRemaining: signal<number | null>(null),
    } as Pick<CombatSocketService, 'activeCombat' | 'latestRound' | 'combatTurnTimeRemaining'>;

    const gameSessionSocketServiceMock = {
        currentSession: signal<GameSession | null>(null),
    } as Pick<GameSessionSocketService, 'currentSession'>;

    const attacker = createCharacter({
        id: 'player-1',
        victories: 0,
        remainingActions: 1,
        position: { x: 1, y: 1 },
    });

    const defender = createCharacter({
        id: 'player-2',
        victories: 0,
        remainingActions: 1,
        position: { x: 2, y: 1 },
    });

    function getCallback<T>(event: string): ListenerCallback<T> {
        const callback = callbacks.get(event);
        expect(callback).toBeDefined();
        return callback as ListenerCallback<T>;
    }

    beforeEach(() => {
        callbacks.clear();
        reachableTilesSignal.set([{ x: 9, y: 9 }]);

        currentSessionSignal = signal<GameSession | null>(
            createSession([
                createPlayer('socket-1', { ...attacker }),
                createPlayer('socket-2', { ...defender }),
            ]),
        );

        gameSessionSocketServiceMock.currentSession.set(currentSessionSignal());
        combatSocketServiceMock.activeCombat.set(null);
        combatSocketServiceMock.latestRound.set(null);
        combatSocketServiceMock.combatTurnTimeRemaining.set(null);

        setupCombatListeners(
            socketServiceMock,
            serviceMock as GamePlaySocketService,
            gameSessionSocketServiceMock as GameSessionSocketService,
            combatSocketServiceMock as CombatSocketService,
        );
    });

    it('devrait enregistrer tous les écouteurs de combat', () => {
        expect(callbacks.has(CombatEvents.CombatStarted)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatTurnStarted)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatTurnTimeUpdate)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatRoundResolved)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatResult)).toBeTrue();
        expect(callbacks.has(CombatEvents.CombatEnded)).toBeTrue();
    });

    it('devrait initialiser le combat et vider les cases atteignables au démarrage', () => {
        getCallback<ActiveCombat>(CombatEvents.CombatStarted)({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        });

        expect(reachableTilesSignal()).toEqual([]);
        expect(combatSocketServiceMock.activeCombat()?.attackerId).toBe('player-1');
        expect(combatSocketServiceMock.latestRound()).toBeNull();
    });

    it('devrait mettre à jour le compteur du tour de combat', () => {
        getCallback<{ timeRemaining: number }>(CombatEvents.CombatTurnStarted)({ timeRemaining: DEFAULT_TURN_TIME });
        expect(combatSocketServiceMock.combatTurnTimeRemaining()).toBe(DEFAULT_TURN_TIME);

        getCallback<{ timeRemaining: number }>(CombatEvents.CombatTurnTimeUpdate)({ timeRemaining: DEFAULT_DEFENSE });
        expect(combatSocketServiceMock.combatTurnTimeRemaining()).toBe(DEFAULT_DEFENSE);
    });

    it('devrait mettre à jour le dernier round et les hp du combat', () => {
        combatSocketServiceMock.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerPosture: 'offensive',
            defenderPosture: 'defensive',
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        });

        getCallback<CombatRoundResolvedPayload>(CombatEvents.CombatRoundResolved)({
            roundNumber: 2,
            attackerId: 'player-1',
            defenderId: 'player-2',
            attackerChoice: 'offensive',
            defenderChoice: 'defensive',
            attackerStrike: {
                attack: { base: DEFAULT_ATTACK, postureBonus: 2, dice: DEFAULT_ATTACK, tilePenalty: 0, total: 10 },
                defense: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 2, tilePenalty: 0, total: DEFAULT_LIFE },
                damage: 3,
            },
            defenderStrike: {
                attack: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                defense: { base: DEFAULT_DEFENSE, postureBonus: 2, dice: 1, tilePenalty: 0, total: 7 },
                damage: 0,
            },
            attackerLife: DEFAULT_LIFE,
            defenderLife: 3,
        });

        expect(combatSocketServiceMock.latestRound()?.roundNumber).toBe(2);
        expect(combatSocketServiceMock.activeCombat()?.defenderHp).toBe(3);
        expect(combatSocketServiceMock.activeCombat()?.attackerPosture).toBeUndefined();
        expect(combatSocketServiceMock.activeCombat()?.defenderPosture).toBeUndefined();
    });

    it('devrait vider l’état local à la fin du combat', () => {
        combatSocketServiceMock.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: DEFAULT_LIFE,
            defenderHp: DEFAULT_LIFE,
        });
        combatSocketServiceMock.latestRound.set({
            roundNumber: 1,
            attackerId: 'player-1',
            defenderId: 'player-2',
            attackerChoice: 'none',
            defenderChoice: 'none',
            attackerStrike: {
                attack: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                defense: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                damage: 0,
            },
            defenderStrike: {
                attack: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                defense: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                damage: 0,
            },
            attackerLife: DEFAULT_LIFE,
            defenderLife: DEFAULT_LIFE,
        });
        combatSocketServiceMock.combatTurnTimeRemaining.set(3);

        getCallback<void>(CombatEvents.CombatEnded)(undefined);

        expect(reachableTilesSignal()).toEqual([]);
        expect(combatSocketServiceMock.activeCombat()).toBeNull();
        expect(combatSocketServiceMock.latestRound()).toBeNull();
        expect(combatSocketServiceMock.combatTurnTimeRemaining()).toBeNull();
    });
});
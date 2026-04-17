import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Tile } from '@app/classes/tile/tile';
import { InteractionMode } from '@app/constants/game-play.constants';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { CombatPosture } from '@common/combat';
import { Dice } from '@common/dice';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { ObjectType, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { TeamId } from '@common/team';

const DEFAULT_ROOM_ID = 'ROOM1';
const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;
const DEFAULT_REMAINING_MOVEMENT = 3;
const DEFAULT_REMAINING_ACTIONS = 1;
const DEFAULT_TURN_TIME = 30;
const MAP_SIZE = '10x10';

/**
 * Stratégie de test pour GamePlaySocketService:
 *
 * 1. Émissions socket orientées actions:
 *    vérifier que les intents utilisateur émettent les bons événements/payloads
 *    (`RequestCombat`, `SubmitCombatPosture`, `RequestInteract`, `EndTurnRequest`).
 *    Vérifier aussi le cas limite `roomId` absent: aucune émission ne doit partir.
 *
 * 2. Garde "combat actif":
 *    confirmer que les actions incompatibles avec un combat en cours
 *    (demander un combat, interagir, terminer le tour) sont bloquées.
 *
 * 3. Règles métier d'attaque:
 *    valider `canAttackTarget` selon l'adjacence, le tour courant et les équipes
 *    (incluant la contrainte allié interdit en mode CTF),
 *    ainsi que les cas limites cible nulle et attaque hors tour.
 *
 * 4. Règles métier d'interaction carte:
 *    valider `canInteractWithTarget` pour les portes et sanctuaires,
 *    incluant les cas limites (porte avec drapeau, cooldown/bonus de sanctuaire).
 *
 * 5. Fiabilité des préconditions locales:
 *    stabiliser les tests avec des états contrôlés (session, map, joueur courant, roomId)
 *    afin d'isoler chaque règle et éviter les faux positifs.
 * Cas limites couverts:
 * - roomId absent: aucune emission sur RequestCombat/SubmitCombatPosture/RequestInteract/EndTurnRequest.
 * - cible d'attaque nulle ou hors tour.
 * - porte sur position du drapeau (interaction refusee).
 * - interaction et fin de tour bloquees en combat actif.
 */

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

function createGame(tiles: Tile[][]): Game {
    const mappedTiles: Game['mapConfig']['tiles'] = tiles.map((row) =>
        row.map((tile) => ({
            type: tile.type,
            doorState: tile.doorState,
            object: tile.object ? { type: tile.object } : undefined,
            sanctuaryCooldown: tile.sanctuaryCooldown,
            sanctuaryOrigin: tile.sanctuaryOrigin,
        })),
    );

    return {
        _id: 'game-1',
        name: 'test',
        description: 'test',
        isVisible: true,
        numberOfPlayers: 2,
        gameMode: 'classic',
        mapConfig: {
            size: MAP_SIZE,
            tiles: mappedTiles,
        },
    };
}

function createEmptyTileGrid(): Tile[][] {
    return [
        [new Tile(), new Tile(), new Tile(), new Tile()],
        [new Tile(), new Tile(), new Tile(), new Tile()],
        [new Tile(), new Tile(), new Tile(), new Tile()],
        [new Tile(), new Tile(), new Tile(), new Tile()],
    ];
}

function createGameSession(
    players: Player[],
    gameMode = 'classic',
    flagPosition: Position | null = null,
): GameSession {
    return {
        players,
        leftPlayers: [],
        status: 'playing' as never,
        roomId: DEFAULT_ROOM_ID,
        maxPlayers: 4,
        mapCopy: null,
        host: players[0],
        mapId: 'map-1',
        socketToAvatar: new Map<string, number>(),
        playerOrder: players.map((player) => player.character.id),
        currentPlayerIndex: 0,
        currentTurnTime: DEFAULT_TURN_TIME,
        startingPoints: new Map<string, Position>(),
        isTurnStarting: false,
        isDebugModeActivated: false,
        gameMode,
        flagPosition,
        activeCombat: null,
        currentCombatTurnTime: DEFAULT_TURN_TIME,
    };
}


describe('GamePlaySocketService', () => {
    let service: GamePlaySocketService;
    let socketServiceSpy: jasmine.SpyObj<SocketService>;
    let currentSessionSignal: WritableSignal<GameSession | null>;
    let gameSessionSocketServiceMock: {
        getRoomId: jasmine.Spy;
        getSocketId: jasmine.Spy;
        currentSession: WritableSignal<GameSession | null>;
        isCurrentUserHost: jasmine.Spy;
    };

    const currentPlayer = createCharacter({
        id: 'player-1',
        name: 'Attacker',
        avatarId: 1,
        team: TeamId.Team1,
        position: { x: 1, y: 1 },
    });

    const defender = createCharacter({
        id: 'player-2',
        name: 'Defender',
        avatarId: 2,
        team: TeamId.Team2,
        position: { x: 2, y: 1 },
    });

    const sameTeamTarget = createCharacter({
        id: 'player-3',
        name: 'Ally',
        avatarId: 3,
        team: TeamId.Team1,
        position: { x: 2, y: 1 },
    });

    const combatSocketServiceMock = {
        activeCombat: signal<unknown | null>(null),
    };

    beforeEach(() => {
        socketServiceSpy = jasmine.createSpyObj<SocketService>('SocketService', [
            'connect',
            'disconnect',
            'on',
            'off',
            'emit',
            'isConnected',
        ]);
        socketServiceSpy.isConnected.and.returnValue(false);

        currentSessionSignal = signal<GameSession | null>(
            createGameSession([
                createPlayer('socket-1', { ...currentPlayer }),
                createPlayer('socket-2', { ...defender }),
            ]),
        );

        gameSessionSocketServiceMock = {
            getRoomId: jasmine.createSpy('getRoomId').and.returnValue(DEFAULT_ROOM_ID),
            getSocketId: jasmine.createSpy('getSocketId').and.returnValue('socket-1'),
            currentSession: currentSessionSignal,
            isCurrentUserHost: jasmine.createSpy('isCurrentUserHost').and.returnValue(true),
        };

        combatSocketServiceMock.activeCombat.set(null);

        TestBed.configureTestingModule({
            providers: [
                GamePlaySocketService,
                { provide: SocketService, useValue: socketServiceSpy },
                { provide: GameSessionSocketService, useValue: gameSessionSocketServiceMock },
                { provide: CombatSocketService, useValue: combatSocketServiceMock },
            ],
        });

        service = TestBed.inject(GamePlaySocketService);
        service.currentPlayerTurn.set('player-1');
        service.mapCopy.set(createGame(createEmptyTileGrid()));
    });

    it('devrait émettre RequestCombat quand un combat est demandé hors combat actif', () => {
        service.requestCombat('player-2');

        expect(socketServiceSpy.emit).toHaveBeenCalledWith(CombatEvents.RequestCombat, {
            roomId: DEFAULT_ROOM_ID,
            defenderId: 'player-2',
        });
    });

    it('ne devrait pas émettre RequestCombat si un combat est déjà actif', () => {
        combatSocketServiceMock.activeCombat.set({ attackerId: 'player-1', defenderId: 'player-2' });

        service.requestCombat('player-2');

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(CombatEvents.RequestCombat, jasmine.anything());
    });

    it('devrait émettre la posture choisie', () => {
        service.chooseCombatPosture(CombatPosture.OFFENSIVE);

        expect(socketServiceSpy.emit).toHaveBeenCalledWith(CombatEvents.SubmitCombatPosture, {
            roomId: DEFAULT_ROOM_ID,
            posture: CombatPosture.OFFENSIVE,
        });
    });

    it('ne devrait pas émettre la posture choisie si roomId est absent', () => {
        gameSessionSocketServiceMock.getRoomId.and.returnValue(undefined);

        service.chooseCombatPosture(CombatPosture.OFFENSIVE);

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(CombatEvents.SubmitCombatPosture, jasmine.anything());
    });

    it('devrait permettre d’attaquer une cible adjacente ennemie pendant son tour', () => {
        expect(service.canAttackTarget(defender)).toBeTrue();
    });

    it('ne devrait pas permettre d’attaquer si la cible est nulle', () => {
        expect(service.canAttackTarget(null)).toBeFalse();
    });

    it('ne devrait pas permettre d engager une attaque automatique hors de son tour', () => {
        service.currentPlayerTurn.set('player-2');

        expect(service.canCurrentPlayerAttack()).toBeFalse();
    });

    it('ne devrait pas permettre d’attaquer un allié en mode CTF', () => {
        currentSessionSignal.set(
            createGameSession(
                [
                    createPlayer('socket-1', { ...currentPlayer }),
                    createPlayer('socket-3', { ...sameTeamTarget }),
                ],
                'ctf',
            ),
        );

        expect(service.canAttackTarget(sameTeamTarget)).toBeFalse();
    });

    it('devrait permettre d’interagir avec une porte adjacente', () => {
        const doorTile = new Tile(TileType.Door);

        expect(service.canInteractWithTarget(doorTile, { x: 2, y: 1 })).toBeTrue();
    });

    it('ne devrait pas permettre d’interagir avec une porte portant le drapeau', () => {
        const doorTile = new Tile(TileType.Door);
        currentSessionSignal.set(
            createGameSession(
                [
                    createPlayer('socket-1', { ...currentPlayer }),
                    createPlayer('socket-2', { ...defender }),
                ],
                'classic',
                { x: 2, y: 1 },
            ),
        );

        expect(service.canInteractWithTarget(doorTile, { x: 2, y: 1 })).toBeFalse();
    });

    it('ne devrait pas émettre RequestInteract pendant un combat actif', () => {
        combatSocketServiceMock.activeCombat.set({ attackerId: 'player-1', defenderId: 'player-2' });

        service.requestInteract({ x: 2, y: 1 }, InteractionMode.Normal);

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(GameSessionEvents.RequestInteract, jasmine.anything());
    });

    it('devrait émettre RequestInteract pour une interaction valide hors combat', () => {
        service.requestInteract({ x: 2, y: 1 }, InteractionMode.Normal);

        expect(socketServiceSpy.emit).toHaveBeenCalledWith(GameSessionEvents.RequestInteract, {
            roomId: DEFAULT_ROOM_ID,
            position: { x: 2, y: 1 },
            mode: InteractionMode.Normal,
        });
    });

    it('ne devrait pas émettre RequestInteract si roomId est absent', () => {
        gameSessionSocketServiceMock.getRoomId.and.returnValue(undefined);

        service.requestInteract({ x: 2, y: 1 }, InteractionMode.Normal);

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(GameSessionEvents.RequestInteract, jasmine.anything());
    });

    it('ne devrait pas émettre EndTurnRequest pendant un combat actif', () => {
        combatSocketServiceMock.activeCombat.set({ attackerId: 'player-1', defenderId: 'player-2' });

        service.endTurn();

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(GameSessionEvents.EndTurnRequest, jasmine.anything());
    });

    it('devrait émettre EndTurnRequest hors combat', () => {
        service.endTurn();

        expect(socketServiceSpy.emit).toHaveBeenCalledWith(GameSessionEvents.EndTurnRequest, {
            roomId: DEFAULT_ROOM_ID,
        });
    });

    it('ne devrait pas émettre EndTurnRequest si roomId est absent', () => {
        gameSessionSocketServiceMock.getRoomId.and.returnValue(undefined);

        service.endTurn();

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(GameSessionEvents.EndTurnRequest, jasmine.anything());
    });

    it('ne devrait pas émettre RequestCombat si roomId est absent', () => {
        gameSessionSocketServiceMock.getRoomId.and.returnValue(undefined);

        service.requestCombat('player-2');

        expect(socketServiceSpy.emit).not.toHaveBeenCalledWith(CombatEvents.RequestCombat, jasmine.anything());
    });

    it('devrait permettre d’interagir avec un sanctuaire de combat si le joueur peut agir et qu’il n’a pas déjà le bonus', () => {
        const tiles = createEmptyTileGrid();
        tiles[1][2].object = ObjectType.CombatSanctuary;
        tiles[1][3].object = ObjectType.CombatSanctuary;
        tiles[2][2].object = ObjectType.CombatSanctuary;
        tiles[2][3].object = ObjectType.CombatSanctuary;
        tiles[1][2].sanctuaryCooldown = 0;

        service.mapCopy.set(createGame(tiles));

        const sanctuaryTile = new Tile();
        sanctuaryTile.object = ObjectType.CombatSanctuary;

        expect(service.canInteractWithTarget(sanctuaryTile, { x: 2, y: 1 })).toBeTrue();
    });
});
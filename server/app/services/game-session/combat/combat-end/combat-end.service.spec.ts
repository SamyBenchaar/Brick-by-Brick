import { GameSession } from '@app/domain/game-session';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { ActiveCombat, CombatOutcome } from '@common/combat';
import { Dice } from '@common/dice';
import { DoorState, TileType } from '@common/map';
import { Player } from '@common/player';
import { CombatEndService } from './combat-end.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;
const ATTACKER_REMAINING_HP = 4;

function createCharacter(overrides: Partial<Character> = {}): Character {
    return {
        id: 'player',
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
        remainingMovement: DEFAULT_MOVEMENTS,
        remainingActions: DEFAULT_ACTIONS,
        victories: 0,
        defeats: 0,
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        tilesVisited: 0,
        hasFlag: false,
        ...overrides,
    };
}

function createPlayer(character: Character): Player {
    return {
        socketId: `${character.id}-socket`,
        character,
    };
}

function createCombat(overrides: Partial<ActiveCombat> = {}): ActiveCombat {
    return {
        attackerId: 'attacker',
        defenderId: 'defender',
        initiatorId: 'attacker',
        roundNumber: 1,
        attackerHp: DEFAULT_LIFE,
        defenderHp: DEFAULT_LIFE,
        ...overrides,
    };
}

/**
 * Strategie de test (Service de logique serveur):
 * Use cases vises:
 * - Resolution de fin de combat: attribution winner/losers, mise a jour HP et statistiques.
 * - Gestion du respawn sur point de depart, et fallback sur la tuile libre la plus proche.
 * - Application des regles CTF apres combat (gestion du drapeau).
 *
 * Mocks / Stubs / Spies:
 * - Mock de GameSessionService (findNearestFreeTile) pour controler le fallback de respawn.
 * - Stubs de GameSession (starting point, map copy, game mode) pour piloter les scenarios metier.
 * - Assertions sur effets de bord (positions, stats, vainqueur) pour valider le comportement observable.
 *
 * Cas limites couverts et raison:
 * - Absence de starting point: garantit une degradation propre sans crash ni etat invalide.
 * - Joueur avec drapeau hors CTF ou sur case invalide: evite un drop incorrect et protege l integrite des regles CTF.
 */
describe('CombatEndService', () => {
    let service: CombatEndService;
    let findNearestFreeTileSpy: jest.Mock;
    let startingPointServiceMock: Partial<StartingPointService>;

    beforeEach(() => {
    findNearestFreeTileSpy = jest.fn();
    startingPointServiceMock = {
        getClosestAvailableTileForFlag: jest.fn(),
    } as Partial<StartingPointService>;

    service = new CombatEndService(
        {
        findNearestFreeTile: findNearestFreeTileSpy,
        } as unknown as GameSessionService,
        startingPointServiceMock as StartingPointService,
    );
    });

    it('devrait faire respawn le perdant, remettre sa vie au max et donner une victoire au gagnant', () => {
        const attacker = createCharacter({
            id: 'attacker',
            position: { x: 1, y: 1 },
            remainingMovement: 2,
        });
        const defender = createCharacter({
            id: 'defender',
            position: { x: 2, y: 1 },
        });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn((id: string) => id === 'defender' ? { x: 5, y: 5 } : { x: 1, y: 1 }),
            getMapCopy: jest.fn(() => null),
        } as unknown as GameSession;

        const result = service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: ATTACKER_REMAINING_HP, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(result.winner?.id).toBe('attacker');
        expect(result.loserIds).toEqual(['defender']);
        expect(attacker.life).toBe(ATTACKER_REMAINING_HP);
        expect(defender.life).toBe(DEFAULT_LIFE);
        expect(defender.position).toEqual({ x: 5, y: 5 });
        expect(attacker.victories).toBe(1);
        expect(defender.defeats).toBe(1);
        expect(result.turnShouldContinue).toBe(true);
    });

    it('devrait utiliser la case libre la plus proche si le point de départ est occupé', () => {
        const attacker = createCharacter({
            id: 'attacker',
            position: { x: 1, y: 1 },
            remainingMovement: 0,
        });
        const defender = createCharacter({
            id: 'defender',
            position: { x: 2, y: 1 },
        });

        const occupiedStart = { x: 1, y: 1 };
        findNearestFreeTileSpy.mockReturnValue({ x: 4, y: 4 });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn(() => occupiedStart),
            getMapCopy: jest.fn(() => null),
        } as unknown as GameSession;

        service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(findNearestFreeTileSpy).toHaveBeenCalledWith(gameSession, occupiedStart);
        expect(defender.position).toEqual({ x: 4, y: 4 });
    });
    it('devrait fallback sur le point de depart si aucun tile libre proche nest trouve', () => {
        const attacker = createCharacter({
            id: 'attacker',
            position: { x: 1, y: 1 },
            remainingMovement: 0,
        });
        const defender = createCharacter({
            id: 'defender',
            position: { x: 2, y: 1 },
        });

        const occupiedStart = { x: 1, y: 1 };
        findNearestFreeTileSpy.mockReturnValue(null);

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn(() => occupiedStart),
            getMapCopy: jest.fn(() => null),
        } as unknown as GameSession;

        service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(findNearestFreeTileSpy).toHaveBeenCalledWith(gameSession, occupiedStart);
        expect(defender.position).toEqual(occupiedStart);
    });

    it('devrait traiter un match nul comme une double défaite sans gagnant', () => {
        const attacker = createCharacter({
            id: 'attacker',
            position: { x: 1, y: 1 },
            remainingMovement: 2,
        });
        const defender = createCharacter({
            id: 'defender',
            position: { x: 2, y: 1 },
        });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn((id: string) => id === 'attacker' ? { x: 0, y: 0 } : { x: 5, y: 5 }),
            getMapCopy: jest.fn(() => null),
        } as unknown as GameSession;

        const result = service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: 0, defenderHp: 0 }),
            outcome: CombatOutcome.DRAW,
        });

        expect(result.winner).toBeNull();
        expect(result.loserIds).toEqual(['attacker', 'defender']);
        expect(attacker.defeats).toBe(1);
        expect(defender.defeats).toBe(1);
        expect(attacker.position).toEqual({ x: 0, y: 0 });
        expect(defender.position).toEqual({ x: 5, y: 5 });
    });

    it('devrait attribuer la victoire au defenseur quand l attaquant est KO', () => {
        const attacker = createCharacter({
            id: 'attacker',
            position: { x: 1, y: 1 },
            remainingMovement: 2,
        });
        const defender = createCharacter({
            id: 'defender',
            position: { x: 2, y: 1 },
        });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn((id: string) => id === 'attacker' ? { x: 0, y: 0 } : { x: 5, y: 5 }),
            getMapCopy: jest.fn(() => null),
        } as unknown as GameSession;

        const result = service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: 0, defenderHp: 3 }),
            outcome: CombatOutcome.DEFENDER,
        });

        expect(result.winner?.id).toBe('defender');
        expect(result.loserIds).toEqual(['attacker']);
        expect(defender.victories).toBe(1);
        expect(attacker.defeats).toBe(1);
        expect(result.turnShouldContinue).toBe(false);
    });

    it('devrait conserver la position si le starting point est introuvable', () => {
        const attacker = createCharacter({ id: 'attacker', position: { x: 1, y: 1 } });
        const defender = createCharacter({ id: 'defender', position: { x: 2, y: 1 } });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn(() => null),
            getMapCopy: jest.fn(() => null),
        } as unknown as GameSession;

        service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(defender.position).toEqual({ x: 2, y: 1 });
        expect(findNearestFreeTileSpy).not.toHaveBeenCalled();
    });

    it('devrait laisser tomber le drapeau sur une case libre proche si le joueur vaincu meurt sur une porte ouverte en CTF', () => {
        const attacker = createCharacter({
            id: 'attacker',
            position: { x: 1, y: 1 },
            remainingMovement: 0,
        });
        const defender = createCharacter({
            id: 'defender',
            position: { x: 2, y: 1 },
            hasFlag: true,
        });

        findNearestFreeTileSpy.mockReturnValue({ x: 3, y: 1 });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'ctf',
            getStartingPoint: jest.fn(() => ({ x: 5, y: 5 })),
            getMapCopy: jest.fn(() => ({
                tiles: [
                    [{ type: TileType.Base }, { type: TileType.Base }, { type: TileType.Base }],
                    [{ type: TileType.Base }, { type: TileType.Base }, { type: TileType.Door, doorState: DoorState.Opened }],
                ],
            })),
            dropFlag: jest.fn(),
        } as unknown as GameSession;

        service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(gameSession.dropFlag).toHaveBeenCalledWith({ x: 3, y: 1 });
    });

    it('ne devrait pas laisser tomber le drapeau hors mode CTF', () => {
        const attacker = createCharacter({ id: 'attacker', position: { x: 1, y: 1 } });
        const defender = createCharacter({ id: 'defender', position: { x: 2, y: 1 }, hasFlag: true });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'classic',
            getStartingPoint: jest.fn(() => ({ x: 5, y: 5 })),
            getMapCopy: jest.fn(() => ({
                tiles: [[{ type: TileType.Base }, { type: TileType.Base }, { type: TileType.Base }]],
            })),
            dropFlag: jest.fn(),
        } as unknown as GameSession;

        service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(gameSession.dropFlag).not.toHaveBeenCalled();
    });

    it('ne devrait pas laisser tomber le drapeau si la case de defaite est introuvable', () => {
        const attacker = createCharacter({ id: 'attacker', position: { x: 1, y: 1 } });
        const defender = createCharacter({ id: 'defender', position: { x: 20, y: 20 }, hasFlag: true });

        const gameSession = {
            players: [createPlayer(attacker), createPlayer(defender)],
            gameMode: 'ctf',
            getStartingPoint: jest.fn(() => ({ x: 5, y: 5 })),
            getMapCopy: jest.fn(() => ({ tiles: [[{ type: TileType.Base }]] })),
            dropFlag: jest.fn(),
        } as unknown as GameSession;

        service.buildCombatEndState({
            gameSession,
            attacker,
            defender,
            combat: createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            outcome: CombatOutcome.ATTACKER,
        });

        expect(gameSession.dropFlag).not.toHaveBeenCalled();
    });
});
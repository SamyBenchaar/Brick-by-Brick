import { GameSession } from '@app/domain/game-session';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { CombatEndService } from './combat-end.service';
import { Character } from '@common/character';
import { ActiveCombat } from '@common/combat';
import { Dice } from '@common/dice';
import { DoorState, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;

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

describe('CombatEndService', () => {
    let service: CombatEndService;
    let findNearestFreeTileSpy: jest.Mock;

    beforeEach(() => {
        findNearestFreeTileSpy = jest.fn();
        service = new CombatEndService({
            findNearestFreeTile: findNearestFreeTileSpy,
        } as unknown as GameSessionService);
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

        const result = service.buildCombatEndState(
            gameSession,
            attacker,
            defender,
            createCombat({ attackerHp: 4, defenderHp: 0 }),
            'attacker',
        );

        expect(result.winner?.id).toBe('attacker');
        expect(result.loserIds).toEqual(['defender']);
        expect(attacker.life).toBe(4);
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

        service.buildCombatEndState(
            gameSession,
            attacker,
            defender,
            createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            'attacker',
        );

        expect(findNearestFreeTileSpy).toHaveBeenCalledWith(gameSession, occupiedStart);
        expect(defender.position).toEqual({ x: 4, y: 4 });
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

        const result = service.buildCombatEndState(
            gameSession,
            attacker,
            defender,
            createCombat({ attackerHp: 0, defenderHp: 0 }),
            'draw',
        );

        expect(result.winner).toBeNull();
        expect(result.loserIds).toEqual(['attacker', 'defender']);
        expect(attacker.defeats).toBe(1);
        expect(defender.defeats).toBe(1);
        expect(attacker.position).toEqual({ x: 0, y: 0 });
        expect(defender.position).toEqual({ x: 5, y: 5 });
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

        service.buildCombatEndState(
            gameSession,
            attacker,
            defender,
            createCombat({ attackerHp: DEFAULT_LIFE, defenderHp: 0 }),
            'attacker',
        );

        expect(gameSession.dropFlag).toHaveBeenCalledWith({ x: 3, y: 1 });
    });
});
import { GameSession } from '@app/domain/game-session';
import { CombatParticipants } from '@app/services/game-session/combat/combat-types';
import { Character } from '@common/character';
import { Dice } from '@common/dice';
import { Player } from '@common/player';
import { TeamId } from '@common/team';
import { CombatRequestValidatorService } from './combat-request-validator.service';

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;

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

function createPlayer(socketId: string, character: Character): Player {
    return { socketId, character };
}

/**
 * Strategie de test:
 * - Valider les preconditions globales de disponibilite d'un combat.
 * - Verifier l'extraction des participants depuis la requete (happy path + absences).
 * - Couvrir les regles metier bloquantes de canStartCombat (tour actif, actions, adjacency, equipes CTF).
 * Cas limites couverts:
 * - Joueur courant, demandeur ou defenseur introuvable.
 * - Distance diagonale ou superposition (non adjacents).
 * - Equipes manquantes en CTF (ne doit pas bloquer a tort).
 */
describe('CombatRequestValidatorService', () => {
    let service: CombatRequestValidatorService;

    beforeEach(() => {
        service = new CombatRequestValidatorService();
    });

    it('devrait considérer le combat indisponible si le tour démarre', () => {
        const session = {
            isTurnStarting: true,
            getActiveCombat: jest.fn(() => null),
        } as unknown as GameSession;

        expect(service.isCombatUnavailable(session)).toBe(true);
    });

    it('devrait considérer le combat indisponible si un combat est déjà actif', () => {
        const session = {
            isTurnStarting: false,
            getActiveCombat: jest.fn(() => ({ attackerId: 'a', defenderId: 'b' })),
        } as unknown as GameSession;

        expect(service.isCombatUnavailable(session)).toBe(true);
    });

    it('devrait considérer le combat disponible si le tour est stable et sans combat actif', () => {
        const session = {
            isTurnStarting: false,
            getActiveCombat: jest.fn(() => null),
        } as unknown as GameSession;

        expect(service.isCombatUnavailable(session)).toBe(false);
    });

    it('devrait retourner les participants valides à partir de la requête', () => {
        const attacker = createCharacter({ id: 'attacker' });
        const defender = createCharacter({ id: 'defender' });
        const requestingPlayer = createPlayer('socket-1', attacker);

        const session = {
            getCurrentPlayer: jest.fn(() => attacker),
            players: [
                requestingPlayer,
                createPlayer('socket-2', defender),
            ],
        } as unknown as GameSession;

        expect(service.getCombatParticipantsFromRequest(session, 'socket-1', 'defender')).toEqual({
            attacker,
            defender,
            requestingPlayer,
        });
    });

    it('devrait retourner null si le demandeur est introuvable', () => {
        const attacker = createCharacter({ id: 'attacker' });
        const defender = createCharacter({ id: 'defender' });

        const session = {
            getCurrentPlayer: jest.fn(() => attacker),
            players: [createPlayer('socket-2', defender)],
        } as unknown as GameSession;

        expect(service.getCombatParticipantsFromRequest(session, 'socket-1', 'defender')).toBeNull();
    });

    it('devrait retourner null si le defenseur est introuvable', () => {
        const attacker = createCharacter({ id: 'attacker' });

        const session = {
            getCurrentPlayer: jest.fn(() => attacker),
            players: [createPlayer('socket-1', attacker)],
        } as unknown as GameSession;

        expect(service.getCombatParticipantsFromRequest(session, 'socket-1', 'defender')).toBeNull();
    });

    it('devrait retourner null si le joueur courant est introuvable', () => {
        const defender = createCharacter({ id: 'defender' });

        const session = {
            getCurrentPlayer: jest.fn(() => undefined),
            players: [createPlayer('socket-1', createCharacter({ id: 'attacker' })), createPlayer('socket-2', defender)],
        } as unknown as GameSession;

        expect(service.getCombatParticipantsFromRequest(session, 'socket-1', 'defender')).toBeNull();
    });

    it('devrait refuser si le demandeur n’est pas le joueur actif', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 2, y: 1 },
            }),
            requestingPlayer: createPlayer(
                'socket-1',
                createCharacter({ id: 'someone-else' }),
            ),
        };

        expect(service.canStartCombat({ gameMode: 'classic' } as unknown as GameSession, participants)).toBe(false);
    });

    it('devrait refuser si l’attaquant n’a plus d’actions', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 0,
                position: { x: 1, y: 1 },
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 2, y: 1 },
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'classic' } as unknown as GameSession, participants)).toBe(false);
    });

    it('devrait refuser si les joueurs ne sont pas adjacents', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 3, y: 1 },
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'classic' } as unknown as GameSession, participants)).toBe(false);
    });

    it('devrait refuser si les joueurs sont en diagonale', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 2, y: 2 },
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'classic' } as unknown as GameSession, participants)).toBe(false);
    });

    it('devrait refuser si les joueurs sont sur la meme case', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 1, y: 1 },
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'classic' } as unknown as GameSession, participants)).toBe(false);
    });

    it('devrait refuser un allié en mode CTF', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
                team: TeamId.Team1,
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 2, y: 1 },
                team: TeamId.Team1,
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'ctf' } as unknown as GameSession, participants)).toBe(false);
    });

    it('devrait autoriser un combat valide contre un ennemi adjacent', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
                team: TeamId.Team1,
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 2, y: 1 },
                team: TeamId.Team2,
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'ctf' } as unknown as GameSession, participants)).toBe(true);
    });

    it('devrait autoriser le combat en CTF si les equipes ne sont pas toutes connues', () => {
        const participants: CombatParticipants = {
            attacker: createCharacter({
                id: 'attacker',
                remainingActions: 1,
                position: { x: 1, y: 1 },
                team: TeamId.Team1,
            }),
            defender: createCharacter({
                id: 'defender',
                position: { x: 2, y: 1 },
                team: undefined,
            }),
            requestingPlayer: createPlayer('socket-1', createCharacter({ id: 'attacker' })),
        };

        expect(service.canStartCombat({ gameMode: 'ctf' } as unknown as GameSession, participants)).toBe(true);
    });
});
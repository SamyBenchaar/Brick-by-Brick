import { TestBed } from '@angular/core/testing';
import { GameSession } from '@app/interfaces/game-session';
import { CombatActionRulesService } from './combat-action-rules.service';

/**
 * Strategie de test:
 * - Valider les preconditions d'action du joueur courant (c est le tour, action restante > 0 et sans combat actif)
 * - Verifier la selection auto de cible adjacente attaquable.
 * - Verifier les regles d'attaque (adjacence, action restante, CTF allie/ennemi).
 * Cas limites couverts:
 * - session/joueur/cible absents.
 * - cible identique au joueur courant.
 * - nombre d actions restantes <= 0 (0 et negatif).
 * - equipes inconnues en mode CTF (attaque autorisee).
 */
describe('CombatActionRulesService', () => {
    let service: CombatActionRulesService;

    const createCharacter = (overrides: Record<string, unknown> = {}) => ({
        id: 'player-1',
        name: 'Player 1',
        avatarId: 1,
        life: 6,
        maxLife: 6,
        attack: 4,
        defense: 4,
        speed: 4,
        movements: 3,
        actions: 1,
        remainingActions: 1,
        remainingMovement: 3,
        position: { x: 1, y: 1 },
        battlesWon: 0,
        isActif: false,
        attackDice: 'D4',
        defenseDice: 'D6',
        victories: 0,
        defeats: 0,
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        tilesVisited: 0,
        hasFlag: false,
        ...overrides,
    });

    const createSession = (gameMode = 'classic', players: { socketId: string; character: Record<string, unknown> }[] = []) => ({
        gameMode,
        players,
    }) as unknown as GameSession;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [CombatActionRulesService],
        });

        service = TestBed.inject(CombatActionRulesService);
    });

    it('devrait autoriser l action si c est le tour, action restante > 0 et sans combat actif', () => {
        const currentPlayer = createCharacter({ remainingActions: 1 });

        expect(service.canCurrentPlayerAct(currentPlayer as never, true, false)).toBeTrue();
    });

    it('devrait refuser l action si currentPlayer est null', () => {
        expect(service.canCurrentPlayerAct(null, true, false)).toBeFalse();
    });

    it('devrait refuser l action si remainingActions est undefined', () => {
        const currentPlayer = createCharacter({ remainingActions: undefined as unknown as number });

        expect(service.canCurrentPlayerAct(currentPlayer as never, true, false)).toBeFalse();
    });

    it('devrait refuser l action si hors tour, sans action ou combat actif', () => {
        const currentPlayer = createCharacter({ remainingActions: 0 });
        const currentPlayerWithNegativeActions = createCharacter({ remainingActions: -1 });

        expect(service.canCurrentPlayerAct(currentPlayer as never, false, false)).toBeFalse();
        expect(service.canCurrentPlayerAct(currentPlayer as never, true, false)).toBeFalse();
        expect(service.canCurrentPlayerAct(currentPlayerWithNegativeActions as never, true, false)).toBeFalse();
        expect(service.canCurrentPlayerAct(createCharacter({ remainingActions: 1 }) as never, true, true)).toBeFalse();
    });

    it('devrait retourner la premiere cible auto attaquable adjacente', () => {
        const currentPlayer = createCharacter({ id: 'p1', position: { x: 1, y: 1 } });
        const adjacentEnemy = createCharacter({ id: 'p2', position: { x: 2, y: 1 } });
        const farEnemy = createCharacter({ id: 'p3', position: { x: 4, y: 4 } });
        const session = createSession('classic', [
            { socketId: 's1', character: currentPlayer },
            { socketId: 's2', character: adjacentEnemy },
            { socketId: 's3', character: farEnemy },
        ]);

        const target = service.getAutoAttackTarget(session, currentPlayer as never);

        expect(target?.id).toBe('p2');
    });

    it('devrait retourner null si session ou joueur courant absent', () => {
        expect(service.getAutoAttackTarget(null, null)).toBeNull();
        expect(service.getAutoAttackTarget(createSession(), null)).toBeNull();
    });

    it('devrait retourner null si aucune cible attaquable nest trouvee', () => {
        const currentPlayer = createCharacter({ id: 'p1', position: { x: 1, y: 1 } });
        const farEnemy = createCharacter({ id: 'p2', position: { x: 4, y: 4 } });
        const session = createSession('classic', [
            { socketId: 's1', character: currentPlayer },
            { socketId: 's2', character: farEnemy },
        ]);

        const target = service.getAutoAttackTarget(session, currentPlayer as never);

        expect(target).toBeNull();
    });

    it('devrait refuser l attaque si cible absente, meme cible, non adjacente ou sans action', () => {
        const currentPlayer = createCharacter({ id: 'p1', position: { x: 1, y: 1 }, remainingActions: 1 });
        const nonAdjacent = createCharacter({ id: 'p2', position: { x: 3, y: 1 } });
        const session = createSession('classic', [
            { socketId: 's1', character: currentPlayer },
            { socketId: 's2', character: nonAdjacent },
        ]);

        expect(service.canCharacterAttackTarget(session, currentPlayer as never, null)).toBeFalse();
        expect(service.canCharacterAttackTarget(session, currentPlayer as never, currentPlayer as never)).toBeFalse();
        expect(service.canCharacterAttackTarget(session, currentPlayer as never, nonAdjacent as never)).toBeFalse();

        const withoutAction = createCharacter({ id: 'p1', position: { x: 1, y: 1 }, remainingActions: 0 });
        const withNegativeAction = createCharacter({ id: 'p1', position: { x: 1, y: 1 }, remainingActions: -1 });
        const adjacent = createCharacter({ id: 'p2', position: { x: 2, y: 1 } });
        expect(service.canCharacterAttackTarget(session, withoutAction as never, adjacent as never)).toBeFalse();
        expect(service.canCharacterAttackTarget(session, withNegativeAction as never, adjacent as never)).toBeFalse();
    });

    it('devrait refuser l attaque si remainingActions est undefined', () => {
        const currentPlayer = createCharacter({ id: 'p1', position: { x: 1, y: 1 }, remainingActions: undefined as unknown as number });
        const adjacent = createCharacter({ id: 'p2', position: { x: 2, y: 1 } });
        const session = createSession('classic', [
            { socketId: 's1', character: currentPlayer },
            { socketId: 's2', character: adjacent },
        ]);

        expect(service.canCharacterAttackTarget(session, currentPlayer as never, adjacent as never)).toBeFalse();
    });

    it('devrait refuser un allie en CTF et autoriser un ennemi', () => {
        const currentPlayer = createCharacter({ id: 'p1', position: { x: 1, y: 1 }, team: 'team1' });
        const ally = createCharacter({ id: 'p2', position: { x: 2, y: 1 }, team: 'team1' });
        const enemy = createCharacter({ id: 'p3', position: { x: 1, y: 2 }, team: 'team2' });
        const session = createSession('ctf', [
            { socketId: 's1', character: currentPlayer },
            { socketId: 's2', character: ally },
            { socketId: 's3', character: enemy },
        ]);

        expect(service.canCharacterAttackTarget(session, currentPlayer as never, ally as never)).toBeFalse();
        expect(service.canCharacterAttackTarget(session, currentPlayer as never, enemy as never)).toBeTrue();
    });

    it('devrait autoriser en CTF si les equipes ne sont pas connues', () => {
        const currentPlayer = createCharacter({ id: 'p1', position: { x: 1, y: 1 }, team: undefined });
        const target = createCharacter({ id: 'p2', position: { x: 2, y: 1 }, team: 'team1' });
        const session = createSession('ctf', [
            { socketId: 's1', character: currentPlayer },
            { socketId: 's2', character: target },
        ]);

        expect(service.canCharacterAttackTarget(session, currentPlayer as never, target as never)).toBeTrue();
    });
});
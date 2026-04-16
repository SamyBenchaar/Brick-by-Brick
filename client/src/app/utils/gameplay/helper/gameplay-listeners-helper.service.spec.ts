import { signal } from '@angular/core';
import { GameSession } from '@app/interfaces/game-session';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';
import { CombatResultPayload } from '@common/combat';
import { Dice } from '@common/dice';
import { handleCombatResult, handleTurnEnded } from './gameplay-listeners-helper.service';

const DEFAULT_LIFE = 6;

function createCharacter(overrides: Partial<Character> = {}): Character {
    return {
        id: 'player',
        isActif: false,
        battlesWon: 0,
        name: 'Player',
        avatarId: 1,
        maxLife: DEFAULT_LIFE,
        life: DEFAULT_LIFE,
        speed: 4,
        attack: 4,
        defense: 4,
        movements: 3,
        actions: 1,
        attackDice: Dice.D4,
        defenseDice: Dice.D6,
        position: { x: 1, y: 1 },
        remainingMovement: 3,
        remainingActions: 1,
        victories: 0,
        defeats: 0,
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        tilesVisited: 0,
        hasFlag: false,
        ...overrides,
    };
}

/**
 * Strategie de test:
 * - Tester les helpers comme fonctions pures de transition detat:
 *   entree (etat initial + payload) -> sortie (etat final observable).
 * - Couvrir les effets de bord critiques de fin de tour (dialogs, timeouts, cooldowns)
 *   pour eviter les fuites detat entre tours.
 * - Couvrir la synchronisation post-combat (session, flags, notification, nettoyage combat local)
 *   en distinguant joueur implique vs non implique.
 * Cas limites couverts:
 * - Aucun currentSession.
 * - Joueur courant absent ou non implique dans le combat.
 * - Cooldown sanctuaire a 1 (suppression de la propriete) et a 0 (inchange).
 *
 * Traceabilite strategie -> tests:
 * - Nettoyage fin de tour: "devrait nettoyer la fin de tour..."
 * - Sync victoire: "devrait synchroniser la session et notifier une victoire..."
 * - Sync draw: "devrait notifier un match nul..."
 * - Non implication: "ne devrait pas notifier si le joueur courant..."
 */
describe('gameplay-listeners-helper', () => {
    let service: unknown;
    let dialog: unknown;
    let flagTransferService: unknown;
    let gameSessionSocketService: unknown;
    let combatSocketService: unknown;

    beforeEach(() => {
        service = {
            currentPlayerTurn: signal<string | null>('player-1'),
            reachableTiles: signal([{ x: 9, y: 9 }]),
            mapCopy: signal<unknown>({
                mapConfig: {
                    tiles: [
                        [{ sanctuaryCooldown: 2 }, { sanctuaryCooldown: 1 }, { sanctuaryCooldown: 0 }],
                    ],
                },
            }),
            pendingFlagTransferTimeouts: new Map<string, ReturnType<typeof setTimeout>>(),
            pendingFlagTransfers: new Map<string, unknown>(),
            respondToFlagTransfer: jasmine.createSpy('respondToFlagTransfer'),
            currentSession: jasmine.createSpy('currentSession'),
            getCurrentPlayerCharacter: jasmine.createSpy('getCurrentPlayerCharacter'),
        };

        const timeoutId = setTimeout(() => undefined, 1000);
        service.pendingFlagTransferTimeouts.set('p1', timeoutId);
        service.pendingFlagTransfers.set('p1', { foo: 'bar' });

        const sanctuaryDialogCloseSpy = jasmine.createSpy('sanctuaryDialogClose');
        dialog = {
            getDialogById: jasmine.createSpy('getDialogById').and.returnValue({ close: sanctuaryDialogCloseSpy }),
        };

        const pendingDialogCloseSpy = jasmine.createSpy('pendingDialogClose');
        flagTransferService = {
            getPendingFlagTransferDialogs: jasmine.createSpy('getPendingFlagTransferDialogs').and.returnValue(
                new Map([
                    ['p1', { fromPlayerId: 'from-1', dialogRef: { close: pendingDialogCloseSpy } }],
                ]),
            ),
            clearAllPendingFlagTransfers: jasmine.createSpy('clearAllPendingFlagTransfers'),
        };

        gameSessionSocketService = {
            currentSession: signal<GameSession | null>(null),
        } as Pick<GameSessionSocketService, 'currentSession'>;

        combatSocketService = {
            activeCombat: signal<unknown>({ attackerId: 'a', defenderId: 'b' }),
            latestRound: signal<unknown>({ roundNumber: 1 }),
            combatTurnTimeRemaining: signal<number | null>(8),
            showCombatNotification: jasmine.createSpy('showCombatNotification'),
        } as Partial<CombatSocketService>;
    });

    afterEach(() => {
        service.pendingFlagTransferTimeouts.forEach((timeout: ReturnType<typeof setTimeout>) => clearTimeout(timeout));
    });

    it('devrait nettoyer la fin de tour, fermer les dialogs en attente et decrementer les cooldowns', () => {
        handleTurnEnded(service as GamePlaySocketService, dialog, flagTransferService as FlagTransferSocketService);

        expect(service.currentPlayerTurn()).toBeNull();
        expect(service.reachableTiles()).toEqual([]);
        expect(dialog.getDialogById).toHaveBeenCalledWith('sanctuary-dialog');
        expect(service.respondToFlagTransfer).toHaveBeenCalledWith('from-1', false);
        expect(flagTransferService.clearAllPendingFlagTransfers).toHaveBeenCalled();
        expect(service.pendingFlagTransferTimeouts.size).toBe(0);
        expect(service.pendingFlagTransfers.size).toBe(0);

        const updatedMap = service.mapCopy();
        expect(updatedMap.mapConfig.tiles[0][0].sanctuaryCooldown).toBe(1);
        expect(updatedMap.mapConfig.tiles[0][1].sanctuaryCooldown).toBeUndefined();
        expect(updatedMap.mapConfig.tiles[0][2].sanctuaryCooldown).toBe(0);
    });

    it('devrait synchroniser la session et notifier une victoire du joueur courant', () => {
        const attacker = createCharacter({ id: 'attacker', life: 6, victories: 0, remainingActions: 1 });
        const defender = createCharacter({ id: 'defender', life: 6, victories: 0, remainingActions: 1 });

        const session = {
            players: [
                { socketId: 's1', character: attacker },
                { socketId: 's2', character: defender },
            ],
            leftPlayers: [],
            flagPosition: null,
            flagHolderId: null,
        } as unknown as GameSession;

        service.currentSession.and.returnValue(session);
        service.getCurrentPlayerCharacter.and.returnValue(attacker);

        const payload: CombatResultPayload = {
            attackerId: 'attacker',
            defenderId: 'defender',
            winnerId: 'attacker',
            loserIds: ['defender'],
            outcome: 'attacker',
            attackerPosition: { x: 1, y: 1 },
            defenderPosition: { x: 5, y: 5 },
            attackerLife: 4,
            defenderLife: 0,
            attackerVictories: 2,
            defenderVictories: 1,
            remainingActions: 0,
            remainingTurnTime: 12,
            turnShouldContinue: false,
            flagPosition: { x: 3, y: 3 },
            flagHolderId: 'attacker',
        };

        handleCombatResult(
            payload,
            service as GamePlaySocketService,
            gameSessionSocketService as GameSessionSocketService,
            combatSocketService as CombatSocketService,
        );

        expect(service.reachableTiles()).toEqual([]);
        expect(combatSocketService.activeCombat()).toBeNull();
        expect(combatSocketService.latestRound()).toBeNull();
        expect(combatSocketService.combatTurnTimeRemaining()).toBeNull();

        const updatedSession = gameSessionSocketService.currentSession();
        expect(updatedSession?.players[0].character.life).toBe(4);
        expect(updatedSession?.players[0].character.victories).toBe(2);
        expect(updatedSession?.players[0].character.remainingActions).toBe(0);
        expect(updatedSession?.players[0].character.hasFlag).toBeTrue();
        expect(updatedSession?.players[1].character.position).toEqual({ x: 5, y: 5 });
        expect(updatedSession?.players[1].character.hasFlag).toBeFalse();
        expect(updatedSession?.flagHolderId).toBe('attacker');

        expect(combatSocketService.showCombatNotification).toHaveBeenCalledWith('Vous avez remporté le combat.');
    });

    it('devrait notifier un match nul si le joueur courant etait implique', () => {
        const currentPlayer = createCharacter({ id: 'defender' });
        service.currentSession.and.returnValue(null);
        service.getCurrentPlayerCharacter.and.returnValue(currentPlayer);

        handleCombatResult(
            {
                attackerId: 'attacker',
                defenderId: 'defender',
                winnerId: null,
                loserIds: ['attacker', 'defender'],
                outcome: 'draw',
                attackerPosition: { x: 1, y: 1 },
                defenderPosition: { x: 2, y: 1 },
                attackerLife: 0,
                defenderLife: 0,
                attackerVictories: 1,
                defenderVictories: 1,
                remainingActions: 0,
                remainingTurnTime: 0,
                turnShouldContinue: false,
                flagPosition: null,
                flagHolderId: null,
            },
            service as GamePlaySocketService,
            gameSessionSocketService as GameSessionSocketService,
            combatSocketService as CombatSocketService,
        );

        expect(combatSocketService.showCombatNotification).toHaveBeenCalledWith('Le combat s\'est terminé par un match nul.');
    });

    it('ne devrait pas notifier si le joueur courant nest pas dans le combat', () => {
        service.currentSession.and.returnValue(null);
        service.getCurrentPlayerCharacter.and.returnValue(createCharacter({ id: 'spectator' }));

        handleCombatResult(
            {
                attackerId: 'attacker',
                defenderId: 'defender',
                winnerId: 'attacker',
                loserIds: ['defender'],
                outcome: 'attacker',
                attackerPosition: { x: 1, y: 1 },
                defenderPosition: { x: 2, y: 1 },
                attackerLife: 4,
                defenderLife: 0,
                attackerVictories: 1,
                defenderVictories: 0,
                remainingActions: 0,
                remainingTurnTime: 10,
                turnShouldContinue: false,
                flagPosition: null,
                flagHolderId: null,
            },
            service as GamePlaySocketService,
            gameSessionSocketService as GameSessionSocketService,
            combatSocketService as CombatSocketService,
        );

        expect(combatSocketService.showCombatNotification).not.toHaveBeenCalled();
    });
});

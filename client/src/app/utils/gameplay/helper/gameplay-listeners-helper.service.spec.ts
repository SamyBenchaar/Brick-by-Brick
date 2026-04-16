import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { handleCombatResult, handleTurnEnded } from '@app/utils/gameplay-listeners/gameplay-listeners-helper.service';
import { Character } from '@common/character';
import { ActiveCombat, CombatOutcome, CombatResultPayload, CombatRoundResolvedPayload } from '@common/combat';
import { Dice } from '@common/dice';

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
    type GamePlaySocketServiceMock = Pick<
        GamePlaySocketService,
        | 'currentPlayerTurn'
        | 'reachableTiles'
        | 'mapCopy'
        | 'respondToFlagTransfer'
        | 'clearAllPendingFlagTransferRequests'
        | 'currentSession'
        | 'getCurrentPlayerCharacter'
    > & {
        respondToFlagTransfer: jasmine.Spy;
        clearAllPendingFlagTransferRequests: jasmine.Spy;
        currentSession: jasmine.Spy;
        getCurrentPlayerCharacter: jasmine.Spy;
    };

    let service: GamePlaySocketServiceMock;
    let dialog: jasmine.SpyObj<MatDialog>;
    let flagTransferService: jasmine.SpyObj<FlagTransferSocketService>;
    let gameSessionSocketService: Pick<GameSessionSocketService, 'currentSession'>;
    let combatSocketService: Pick<
        CombatSocketService,
        'activeCombat' | 'latestRound' | 'combatTurnTimeRemaining' | 'showCombatNotification'
    > & { showCombatNotification: jasmine.Spy };

    beforeEach(() => {
        service = {
            currentPlayerTurn: signal<string | null>('player-1'),
            reachableTiles: signal([{ x: 9, y: 9 }]),
            mapCopy: signal<Game | null>({
                mapConfig: {
                    tiles: [
                        [{ sanctuaryCooldown: 2 }, { sanctuaryCooldown: 1 }, { sanctuaryCooldown: 0 }],
                    ],
                },
            } as Game),
            respondToFlagTransfer: jasmine.createSpy('respondToFlagTransfer'),
            clearAllPendingFlagTransferRequests: jasmine.createSpy('clearAllPendingFlagTransferRequests'),
            currentSession: jasmine.createSpy('currentSession'),
            getCurrentPlayerCharacter: jasmine.createSpy('getCurrentPlayerCharacter'),
        };

        const sanctuaryDialogCloseSpy = jasmine.createSpy('sanctuaryDialogClose');
        dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['getDialogById']);
        dialog.getDialogById.and.returnValue({ close: sanctuaryDialogCloseSpy } as never);

        const pendingDialogCloseSpy = jasmine.createSpy('pendingDialogClose');
        flagTransferService = jasmine.createSpyObj<FlagTransferSocketService>(
            'FlagTransferSocketService',
            ['getPendingFlagTransferDialogs', 'clearAllPendingFlagTransfers'],
        );
        flagTransferService.getPendingFlagTransferDialogs.and.returnValue([
            ['p1', { fromPlayerId: 'from-1', dialogRef: { close: pendingDialogCloseSpy } } as never],
        ]);

        gameSessionSocketService = {
            currentSession: signal<GameSession | null>(null),
        } as Pick<GameSessionSocketService, 'currentSession'>;

        combatSocketService = {
            activeCombat: signal<ActiveCombat | null>({ attackerId: 'a', defenderId: 'b' } as ActiveCombat),
            latestRound: signal<CombatRoundResolvedPayload | null>({ roundNumber: 1 } as CombatRoundResolvedPayload),
            combatTurnTimeRemaining: signal<number | null>(8),
            showCombatNotification: jasmine.createSpy('showCombatNotification'),
        };
    });

    afterEach(() => {
        flagTransferService.clearAllPendingFlagTransfers.calls.reset();
    });

    it('devrait nettoyer la fin de tour, fermer les dialogs en attente et decrementer les cooldowns', () => {
        handleTurnEnded(service as unknown as GamePlaySocketService, dialog, flagTransferService as FlagTransferSocketService);

        expect(service.currentPlayerTurn()).toBeNull();
        expect(service.reachableTiles()).toEqual([]);
        expect(dialog.getDialogById).toHaveBeenCalledWith('sanctuary-dialog');
        expect(service.respondToFlagTransfer).toHaveBeenCalledWith('from-1', false);
        expect(flagTransferService.clearAllPendingFlagTransfers).toHaveBeenCalled();
        expect(service.clearAllPendingFlagTransferRequests).toHaveBeenCalled();

        const updatedMap = service.mapCopy();
        expect(updatedMap).not.toBeNull();
        if (!updatedMap) {
            fail('Map copy should be defined after turn end handling');
            return;
        }
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
            outcome: CombatOutcome.ATTACKER,
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
            {
                gamePlaySocketService: service as unknown as GamePlaySocketService,
                gameSessionSocketService: gameSessionSocketService as GameSessionSocketService,
                combatSocketService: combatSocketService as unknown as CombatSocketService,
            },
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
                outcome: CombatOutcome.DRAW,
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
            {
                gamePlaySocketService: service as unknown as GamePlaySocketService,
                gameSessionSocketService: gameSessionSocketService as GameSessionSocketService,
                combatSocketService: combatSocketService as unknown as CombatSocketService,
            },
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
                outcome: CombatOutcome.ATTACKER,
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
            {
                gamePlaySocketService: service as unknown as GamePlaySocketService,
                gameSessionSocketService: gameSessionSocketService as GameSessionSocketService,
                combatSocketService: combatSocketService as unknown as CombatSocketService,
            },
        );

        expect(combatSocketService.showCombatNotification).not.toHaveBeenCalled();
    });
});

import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CombatSocketService } from './combat-socket.service';
import { GamePlaySocketService } from './game-play-socket.service';

/**
 * Strategie de test:
 * - Verifier les derivees self/other et HP selon l'etat de combat.
 * - Verifier la detection de participation au combat.
 * - Verifier le cycle de vie des notifications (timer et nettoyage).
 * Cas limites couverts:
 * - absence de combat actif.
 * - joueur courant absent.
 * - remplacement d'une notification avant expiration.
 */
describe('CombatSocketService', () => {
    let service: CombatSocketService;

    const currentPlayer = {
        id: 'player-1',
        name: 'Attacker',
        avatarId: 1,
        life: 6,
        maxLife: 6,
        attack: 4,
        defense: 4,
    };

    const otherPlayer = {
        id: 'player-2',
        name: 'Defender',
        avatarId: 2,
        life: 5,
        maxLife: 5,
        attack: 3,
        defense: 5,
    };

    const gamePlaySocketServiceMock = {
        getCurrentPlayerCharacter: jasmine.createSpy('getCurrentPlayerCharacter').and.returnValue(currentPlayer),
        getCharacter: jasmine.createSpy('getCharacter').and.callFake((id: string) => (id === 'player-2' ? otherPlayer : null)),
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                CombatSocketService,
                { provide: GamePlaySocketService, useValue: gamePlaySocketServiceMock },
            ],
        });

        gamePlaySocketServiceMock.getCurrentPlayerCharacter.calls.reset();
        gamePlaySocketServiceMock.getCurrentPlayerCharacter.and.returnValue(currentPlayer);
        gamePlaySocketServiceMock.getCharacter.calls.reset();
        gamePlaySocketServiceMock.getCharacter.and.callFake((id: string) => (id === 'player-2' ? otherPlayer : null));

        service = TestBed.inject(CombatSocketService);
        service.activeCombat.set(null);
        service.latestRound.set(null);
        service.combatNotification.set(null);
    });

    it('devrait retourner self/other et les hp de combat quand un combat est actif', () => {
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 4,
            defenderHp: 2,
        });

        expect(service.self()?.id).toBe('player-1');
        expect(service.other()?.id).toBe('player-2');
        expect(service.selfHp()).toBe(4);
        expect(service.otherHp()).toBe(2);
    });

    it('devrait calculer les hp correctement quand le joueur courant est defenseur', () => {
        gamePlaySocketServiceMock.getCurrentPlayerCharacter.and.returnValue(otherPlayer);
        gamePlaySocketServiceMock.getCharacter.and.callFake((id: string) => {
            if (id === 'player-1') {
                return currentPlayer;
            }
            if (id === 'player-2') {
                return otherPlayer;
            }
            return null;
        });
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 4,
            defenderHp: 2,
        });

        expect(service.selfHp()).toBe(2);
        expect(service.otherHp()).toBe(4);
    });

    it('devrait retomber sur les hp de base hors combat', () => {
        expect(service.selfHp()).toBe(6);
        expect(service.otherHp()).toBe(0);
    });

    it('devrait retourner 0 pour selfHp si aucun joueur courant nest disponible', () => {
        gamePlaySocketServiceMock.getCurrentPlayerCharacter.and.returnValue(null);

        expect(service.selfHp()).toBe(0);
    });

    it('devrait detecter si le joueur courant participe au combat', () => {
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.isCurrentUserInCombat()).toBeTrue();
    });

    it('devrait retourner false si le joueur courant est absent', () => {
        gamePlaySocketServiceMock.getCurrentPlayerCharacter.and.returnValue(null);
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.isCurrentUserInCombat()).toBeFalse();
    });

    it('devrait retourner null pour other si le joueur courant est absent', () => {
        gamePlaySocketServiceMock.getCurrentPlayerCharacter.and.returnValue(null);
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.getOther()).toBeNull();
    });

    it('devrait retourner null pour other si l autre personnage est introuvable', () => {
        gamePlaySocketServiceMock.getCharacter.and.returnValue(null);
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.getOther()).toBeNull();
    });

    it('devrait calculer les participants du combat selon letat actif', () => {
        expect(service.combatParticipantIds()).toEqual([]);

        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.combatParticipantIds()).toEqual(['player-1', 'player-2']);
    });

    it('devrait afficher puis effacer la notification apres delai', fakeAsync(() => {
        service.showCombatNotification('Victoire');

        expect(service.combatNotification()).toBe('Victoire');

        tick(2999);
        expect(service.combatNotification()).toBe('Victoire');

        tick(1);
        expect(service.combatNotification()).toBeNull();
    }));

    it('devrait remplacer l ancienne notification et annuler son ancien timer', fakeAsync(() => {
        service.showCombatNotification('Premiere');
        tick(1500);

        service.showCombatNotification('Deuxieme');
        tick(1499);
        expect(service.combatNotification()).toBe('Deuxieme');

        tick(1501);
        expect(service.combatNotification()).toBeNull();
    }));
});
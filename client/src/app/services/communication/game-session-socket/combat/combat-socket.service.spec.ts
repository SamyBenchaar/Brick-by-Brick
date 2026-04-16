import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CombatSocketService } from '../combat-socket.service';
import { GamePlaySocketService } from '../game-play-socket.service';

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
        getCharacter: jasmine.createSpy('getCharacter').and.callFake((id: string) => id === 'player-2' ? otherPlayer : null),
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
        gamePlaySocketServiceMock.getCharacter.and.callFake((id: string) => id === 'player-2' ? otherPlayer : null);

        service = TestBed.inject(CombatSocketService);
        service.activeCombat.set(null);
        service.latestRound.set(null);
        service.combatNotification.set(null);
    });

    it('devrait retourner self et other à partir de la session courante', () => {
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.self()?.id).toBe('player-1');
        expect(service.other()?.id).toBe('player-2');
    });

    it('devrait calculer les hp de combat quand un combat est actif', () => {
        service.activeCombat.set({
            attackerId: 'player-1',
            defenderId: 'player-2',
            initiatorId: 'player-1',
            roundNumber: 1,
            attackerHp: 4,
            defenderHp: 2,
        });

        expect(service.selfHp()).toBe(4);
        expect(service.otherHp()).toBe(2);
    });

    it('devrait retourner les hp du personnage courant et 0 pour l autre hors combat', () => {
        expect(service.selfHp()).toBe(6);
        expect(service.otherHp()).toBe(0);
    });

    it('devrait détecter si le joueur courant participe au combat', () => {
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

    it('devrait retourner false si aucun combat actif ne concerne le joueur courant', () => {
        service.activeCombat.set({
            attackerId: 'player-3',
            defenderId: 'player-4',
            initiatorId: 'player-3',
            roundNumber: 1,
            attackerHp: 6,
            defenderHp: 5,
        });

        expect(service.isCurrentUserInCombat()).toBeFalse();
    });

    it('devrait afficher puis effacer automatiquement la notification après 3 secondes', fakeAsync(() => {
        service.showCombatNotification('Victoire');

        expect(service.combatNotification()).toBe('Victoire');

        tick(2999);
        expect(service.combatNotification()).toBe('Victoire');

        tick(1);
        expect(service.combatNotification()).toBeNull();
    }));

    it('devrait remplacer l’ancienne notification sans laisser l’ancien timer actif', fakeAsync(() => {
        service.showCombatNotification('Première');
        tick(1500);

        service.showCombatNotification('Deuxième');
        tick(1499);
        expect(service.combatNotification()).toBe('Deuxième');

        tick(1501);
        expect(service.combatNotification()).toBeNull();
    }));

    it('devrait effacer immédiatement la notification quand clearCombatNotification est appelé', () => {
        service.showCombatNotification('Défaite');

        service.clearCombatNotification();

        expect(service.combatNotification()).toBeNull();
    });
});

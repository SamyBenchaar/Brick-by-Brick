import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { COMBAT_POSTURE, CombatRoundResolvedPayload } from '@common/combat';
import { CombatViewComponent } from './combat-view.component';
import { PlayerCombatCardComponent } from './player-combat-card/player-combat-card.component';

const TEST_HP = 10;
const TURN_TIME = 15;

/**
 * Stratégie de test pour CombatViewComponent:
 *
 * 1. Interaction composant → service : un clic sur une posture doit appeler GamePlaySocketService.
 * 2. Interaction composant → composant : les deux PlayerCombatCardComponent reçoivent les bonnes données.
 * 3. Affichage réactif : les détails attaque/défense doivent suivre le rôle attaquant/défenseur.
 * 4. Cas limites : réinitialisation de l'état local lors d'un nouveau combat.
 */

describe('CombatViewComponent', () => {
    let component: CombatViewComponent;
    let fixture: ComponentFixture<CombatViewComponent>;

    const mockCombatSocketService = {
        self: signal({
            id: 'player-1',
            name: 'Player 1',
            avatarId: 1,
            maxLife: TEST_HP,
            life: TEST_HP,
            attack: 4,
            defense: 4,
        }),
        other: signal({
            id: 'player-2',
            name: 'Player 2',
            avatarId: 2,
            maxLife: TEST_HP,
            life: TEST_HP,
            attack: 5,
            defense: 3,
        }),
        latestRound: signal<CombatRoundResolvedPayload | null>(null),
        selfHp: signal(TEST_HP),
        otherHp: signal(TEST_HP),
        combatTurnTimeRemaining: signal<number | null>(TURN_TIME),
        activeCombat: signal<unknown | null>(null),
    };

    const mockGamePlaySocketService = {
        chooseCombatPosture: jasmine.createSpy('chooseCombatPosture'),
    };

    const roundPayload: CombatRoundResolvedPayload = {
        roundNumber: 2,
        attackerId: 'player-1',
        defenderId: 'player-2',
        attackerChoice: COMBAT_POSTURE.OFFENSIVE,
        defenderChoice: COMBAT_POSTURE.DEFENSIVE,
        attackerStrike: {
            attack: { base: 4, postureBonus: 2, dice: 3, tilePenalty: 0, total: 9 },
            defense: { base: 3, postureBonus: 2, dice: 1, tilePenalty: 0, total: 6 },
            damage: 3,
        },
        defenderStrike: {
            attack: { base: 5, postureBonus: 0, dice: 2, tilePenalty: 0, total: 7 },
            defense: { base: 4, postureBonus: 0, dice: 4, tilePenalty: 0, total: 8 },
            damage: 1,
        },
        attackerLife: 9,
        defenderLife: 7,
    };

    beforeEach(async () => {
        mockCombatSocketService.latestRound.set(null);
        mockCombatSocketService.activeCombat.set(null);
        mockCombatSocketService.selfHp.set(TEST_HP);
        mockCombatSocketService.otherHp.set(TEST_HP);
        mockCombatSocketService.combatTurnTimeRemaining.set(TURN_TIME);
        mockGamePlaySocketService.chooseCombatPosture.calls.reset();

        await TestBed.configureTestingModule({
            imports: [CombatViewComponent],
            providers: [
                { provide: CombatSocketService, useValue: mockCombatSocketService },
                { provide: GamePlaySocketService, useValue: mockGamePlaySocketService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CombatViewComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait appeler le service avec la posture offensive au clic', () => {
        const buttons = fixture.debugElement.queryAll(By.css('button'));

        buttons[1].nativeElement.click();
        fixture.detectChanges();

        expect(mockGamePlaySocketService.chooseCombatPosture).toHaveBeenCalledWith(COMBAT_POSTURE.OFFENSIVE);
        expect(component.hasChosen()).toBeTrue();
        expect(component.posture()).toBe(COMBAT_POSTURE.OFFENSIVE);
    });

    it('devrait appeler le service avec la posture défensive au clic', () => {
        const buttons = fixture.debugElement.queryAll(By.css('button'));

        buttons[0].nativeElement.click();
        fixture.detectChanges();

        expect(mockGamePlaySocketService.chooseCombatPosture).toHaveBeenCalledWith(COMBAT_POSTURE.DEFENSIVE);
        expect(component.hasChosen()).toBeTrue();
        expect(component.posture()).toBe(COMBAT_POSTURE.DEFENSIVE);
    });

    it('devrait mapper les détails correctement quand le joueur courant est attaquant', () => {
        mockCombatSocketService.latestRound.set(roundPayload);
        fixture.detectChanges();

        expect(component.isSelfAttacker()).toBeTrue();
        expect(component.selfAttackDetail()).toEqual(roundPayload.attackerStrike.attack);
        expect(component.selfDefenseDetail()).toEqual(roundPayload.attackerStrike.defense);
        expect(component.otherAttackDetail()).toEqual(roundPayload.defenderStrike.attack);
        expect(component.otherDefenseDetail()).toEqual(roundPayload.defenderStrike.defense);
    });

    it('devrait inverser les détails quand le joueur courant est défenseur', () => {
        mockCombatSocketService.self.set({
            ...mockCombatSocketService.self(),
            id: 'player-2',
        });
        mockCombatSocketService.latestRound.set(roundPayload);
        fixture.detectChanges();

        expect(component.isSelfAttacker()).toBeFalse();
        expect(component.selfAttackDetail()).toEqual(roundPayload.defenderStrike.attack);
        expect(component.selfDefenseDetail()).toEqual(roundPayload.defenderStrike.defense);
        expect(component.otherAttackDetail()).toEqual(roundPayload.attackerStrike.attack);
        expect(component.otherDefenseDetail()).toEqual(roundPayload.attackerStrike.defense);
    });

    it('devrait transmettre les bonnes données aux deux cartes de combat', () => {
        mockCombatSocketService.latestRound.set(roundPayload);
        mockCombatSocketService.selfHp.set(9);
        mockCombatSocketService.otherHp.set(7);
        fixture.detectChanges();

        const cards = fixture.debugElement.queryAll(By.directive(PlayerCombatCardComponent));

        expect(cards.length).toBe(2);
        expect(cards[0].componentInstance.character.name).toBe('Player 1');
        expect(cards[0].componentInstance.currentHp).toBe(9);
        expect(cards[1].componentInstance.character.name).toBe('Player 2');
        expect(cards[1].componentInstance.currentHp).toBe(7);
    });

    it('devrait réinitialiser hasChosen quand un nouveau combat devient actif', () => {
        component.hasChosen.set(true);

        mockCombatSocketService.activeCombat.set({ attackerId: 'player-1', defenderId: 'player-2' });
        fixture.detectChanges();

        expect(component.hasChosen()).toBeFalse();
    });
});

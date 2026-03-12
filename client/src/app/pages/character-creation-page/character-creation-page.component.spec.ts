import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BASE_ATTACK, BASE_DEFENSE, BASE_LIFE, BASE_SPEED, BONUS_AMOUNT } from '@app/constants/character.constants';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { of } from 'rxjs';
import { CharacterCreationPageComponent } from './character-creation-page.component';

/**
 * Stratégie de test pour CharacterCreationPageComponent:
 *
 * 1. Création de base : Vérifier les valeurs par défaut du personnage
 * 2. Sélection d'avatar : Vérifier le changement d'avatar
 * 3. Bonus : Vérifier l'application correcte du bonus vie/rapidité
 * 4. Dés : Vérifier la logique d'inversion des dés attaque/défense
 * 5. Validation : Bouton désactivé sans nom ou bonus
 * 6. Soumission : Rejoindre existant vs créer nouvelle session
 * 7. Personnage aléatoire : Vérifier que les champs sont remplis
 */
describe('CharacterCreationPageComponent', () => {
    let component: CharacterCreationPageComponent;
    let fixture: ComponentFixture<CharacterCreationPageComponent>;
    let mockGameSessionSocketService: jasmine.SpyObj<GameSessionSocketService>;
    let routerMock: jasmine.SpyObj<Router>;

    beforeEach(async () => {
        mockGameSessionSocketService = jasmine.createSpyObj('GameSessionSocketService', [
            'connect', 'createGameSession', 'joinGameSession',
        ], {
            currentSession: { set: jasmine.createSpy() },
            roomId: { set: jasmine.createSpy() },
            mapCopy: { set: jasmine.createSpy() },
        });

        routerMock = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [CharacterCreationPageComponent, FormsModule],
            providers: [
                { provide: GameSessionSocketService, useValue: mockGameSessionSocketService },
                { provide: Router, useValue: routerMock },
                {
                    provide: ActivatedRoute,
                    useValue: { queryParams: of({ roomId: 'ROOM1' }) },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CharacterCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    describe('Création de base', () => {
        it('devrait créer le composant', () => {
            expect(component).toBeTruthy();
        });

        it('devrait initialiser un personnage avec les valeurs de base', () => {
            const char = component.createBaseCharacter(1);
            expect(char.life).toBe(BASE_LIFE);
            expect(char.speed).toBe(BASE_SPEED);
            expect(char.attack).toBe(BASE_ATTACK);
            expect(char.defense).toBe(BASE_DEFENSE);
            expect(char.name).toBe('');
        });

        it('devrait connecter le socket au init', () => {
            expect(mockGameSessionSocketService.connect).toHaveBeenCalled();
        });
    });

    describe('Avatar', () => {
        it('devrait changer l\'avatar sélectionné', () => {
            component.selectAvatar({ id: 5, name: 'test', image: 'test.png' });
            expect(component.character.avatarId).toBe(5);
        });

        it('devrait retourner l\'image de l\'avatar sélectionné', () => {
            component.character.avatarId = 1;
            const image = component.getSelectedAvatarImage();
            expect(image).toContain('lily');
        });
    });

    describe('Bonus', () => {
        it('devrait appliquer le bonus vie', () => {
            component.applyBonus('life');
            expect(component.character.life).toBe(BASE_LIFE + BONUS_AMOUNT);
            expect(component.character.speed).toBe(BASE_SPEED);
            expect(component.bonusTarget).toBe('life');
        });

        it('devrait appliquer le bonus rapidité', () => {
            component.applyBonus('speed');
            expect(component.character.speed).toBe(BASE_SPEED + BONUS_AMOUNT);
            expect(component.character.life).toBe(BASE_LIFE);
            expect(component.bonusTarget).toBe('speed');
        });

        it('devrait réinitialiser le bonus précédent en changeant', () => {
            component.applyBonus('life');
            component.applyBonus('speed');
            expect(component.character.life).toBe(BASE_LIFE);
            expect(component.character.speed).toBe(BASE_SPEED + BONUS_AMOUNT);
        });
    });

    describe('Dés', () => {
        it('devrait inverser le dé de défense quand on choisit attaque D6', () => {
            component.setDice('attackDice', 'D6');
            expect(component.character.attackDice).toBe('D6');
            expect(component.character.defenseDice).toBe('D4');
        });

        it('devrait inverser le dé d\'attaque quand on choisit défense D6', () => {
            component.setDice('defenseDice', 'D6');
            expect(component.character.defenseDice).toBe('D6');
            expect(component.character.attackDice).toBe('D4');
        });
    });

    describe('Validation du formulaire', () => {
        it('devrait être désactivé sans nom', () => {
            component.character.name = '';
            component.bonusTarget = 'life';
            expect(component.isSubmitDisabled()).toBeTrue();
        });

        it('devrait être désactivé sans bonus', () => {
            component.character.name = 'Test';
            component.bonusTarget = null;
            expect(component.isSubmitDisabled()).toBeTrue();
        });

        it('devrait être désactivé si le nom contient des espaces', () => {
            component.character.name = 'Test Name';
            component.bonusTarget = 'life';
            expect(component.isSubmitDisabled()).toBeTrue();
        });

        it('devrait être activé avec nom et bonus', () => {
            component.character.name = 'TestHero';
            component.bonusTarget = 'life';
            expect(component.isSubmitDisabled()).toBeFalse();
        });
    });

    describe('Tooltip', () => {
        it('devrait mentionner le nom manquant', () => {
            component.character.name = '';
            component.bonusTarget = 'life';
            expect(component.getTooltipText()).toContain('nom du personnage');
        });

        it('devrait mentionner le bonus manquant', () => {
            component.character.name = 'Test';
            component.bonusTarget = null;
            expect(component.getTooltipText()).toContain('bonus');
        });

        it('devrait mentionner les espaces dans le nom', () => {
            component.character.name = 'Test Name';
            component.bonusTarget = 'life';
            expect(component.getTooltipText()).toContain('espaces');
        });
    });

    describe('Personnage aléatoire', () => {
        it('devrait générer un personnage avec nom, bonus et dés', () => {
            component.createRandomCharacter();

            expect(component.character.name).toBeTruthy();
            expect(component.bonusTarget).toBeTruthy();
            expect(['D4', 'D6']).toContain(component.character.attackDice);
            expect(['D4', 'D6']).toContain(component.character.defenseDice);
            expect(component.character.attackDice).not.toBe(component.character.defenseDice);
        });
    });

    describe('Soumission', () => {
        it('devrait appeler joinGameSession quand roomId est présent', () => {
            component.roomId = 'ROOM1';
            component.character.name = 'Test';

            component.submitCharacter();

            expect(mockGameSessionSocketService.joinGameSession).toHaveBeenCalledWith('ROOM1', component.character);
            expect(routerMock.navigate).toHaveBeenCalledWith(['/waiting-room', 'ROOM1']);
        });

        it('ne devrait pas soumettre sans gameId ni roomId', () => {
            component.gameId = null;
            component.roomId = null;

            spyOn(window, 'alert');
            component.submitCharacter();

            expect(window.alert).toHaveBeenCalled();
        });

        it('devrait stocker le nom dans sessionStorage', () => {
            component.roomId = 'ROOM1';
            component.character.name = 'MonNom';

            component.submitCharacter();

            expect(sessionStorage.getItem('playerUsername')).toBe('MonNom');
        });
    });

    describe('Navigation', () => {
        it('devrait naviguer vers game-creation au close', () => {
            component.close();
            expect(routerMock.navigate).toHaveBeenCalledWith(['/game-creation']);
        });
    });
});

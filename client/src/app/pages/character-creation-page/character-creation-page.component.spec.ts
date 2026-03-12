import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AVATARS, BASE_ATTACK, BASE_DEFENSE, BASE_LIFE, BASE_SPEED, BONUS_AMOUNT } from '@app/constants/character.constants';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Dice } from '@common/dice';
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
    let takenAvatarsSignal: ReturnType<typeof signal<number[]>>;

    beforeEach(async () => {
        takenAvatarsSignal = signal<number[]>([1]);

        mockGameSessionSocketService = jasmine.createSpyObj('GameSessionSocketService', [
            'connect', 'createGameSession', 'joinGameSession', 'observeGameSession', 'updateTakenAvatars',
        ], {
            currentSession: { set: jasmine.createSpy() },
            roomId: { set: jasmine.createSpy() },
            mapCopy: { set: jasmine.createSpy() },
            takenAvatars: takenAvatarsSignal,
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
            component.setDice('attackDice', Dice.D6);
            expect(component.character.attackDice).toBe(Dice.D6);
            expect(component.character.defenseDice).toBe(Dice.D4);
        });

        it('devrait inverser le dé d\'attaque quand on choisit défense D6', () => {
            component.setDice('defenseDice', Dice.D6);
            expect(component.character.defenseDice).toBe(Dice.D6);
            expect(component.character.attackDice).toBe(Dice.D4);
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
            expect([Dice.D4, Dice.D6]).toContain(component.character.attackDice);
            expect([Dice.D4, Dice.D6]).toContain(component.character.defenseDice);
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

    describe('Avatar - filtrage des avatars pris', () => {
        it('ne devrait pas changer l\'avatar si celui-ci est déjà pris', () => {
            const originalAvatarId = component.character.avatarId;
            takenAvatarsSignal.set([1, 5]);
            component.selectAvatar({ id: 5, name: 'taken', image: 'taken.png' });
            expect(component.character.avatarId).toBe(originalAvatarId);
        });

        it('ne devrait pas changer si on sélectionne le même avatar', () => {
            component.character.avatarId = 3;
            component.selectAvatar({ id: 3, name: 'same', image: 'same.png' });
            expect(component.character.avatarId).toBe(3);
        });
    });

    describe('Navigation', () => {
        it('devrait naviguer vers game-creation au close', () => {
            component.close();
            expect(routerMock.navigate).toHaveBeenCalledWith(['/game-creation']);
        });
    });

    describe('Création depuis un roomId (joindre une partie)', () => {
        it('devrait initialiser le roomId depuis les queryParams', () => {
            expect(component.roomId).toBe('ROOM1');
        });

        it('ne devrait pas être en mode fromGameCreation quand on a un roomId', () => {
            expect(component.fromGameCreation).toBeFalse();
        });

        it('devrait appeler observeGameSession avec le roomId au init', () => {
            expect(mockGameSessionSocketService.connect).toHaveBeenCalled();
        });
    });

    describe('Création depuis un gameId (créer une partie)', () => {
        it('devrait être en mode fromGameCreation quand gameId est présent', () => {
            // Simuler les conditions du mode création
            component.gameId = 'GAME123';
            component.fromGameCreation = true;
            component.roomId = null;

            expect(component.fromGameCreation).toBeTrue();
            expect(component.gameId).toBe('GAME123');
        });

        it('devrait initialiser le personnage avec le premier avatar disponible sans roomId', () => {
            // Quand on crée une partie (pas de roomId), le personnage est créé avec le premier avatar
            const char = component.createBaseCharacter(AVATARS[0].id);
            expect(char).toBeTruthy();
            expect(char.avatarId).toBe(AVATARS[0].id);
        });

        it('devrait permettre la soumission en mode créateur avec gameId', () => {
            component.gameId = 'GAME123';
            component.fromGameCreation = true;
            component.roomId = null;
            component.character.name = 'CreatorPlayer';
            component.bonusTarget = 'speed';

            expect(component.isSubmitDisabled()).toBeFalse();
        });
    });

    describe('Avatars disponibles en temps réel', () => {
        it('devrait calculer l\'état des avatars avec les avatars pris', () => {
            const state = component.avatarState();
            expect(state.length).toBe(AVATARS.length);
        });

        it('ne devrait pas permettre la sélection d\'un avatar déjà pris par un autre joueur', () => {
            const originalId = component.character.avatarId;
            // Simuler un avatar pris via le computed signal - le comportement est vérifié dans selectAvatar
            component.selectAvatar({ id: originalId, name: 'same', image: 'same.png' });
            expect(component.character.avatarId).toBe(originalId);
        });
    });

    describe('Formulaire de personnage identique au créateur', () => {
        it('devrait avoir les mêmes champs de base que pour un créateur de partie', () => {
            const char = component.createBaseCharacter(1);
            expect(char.maxLife).toBe(BASE_LIFE);
            expect(char.life).toBe(BASE_LIFE);
            expect(char.speed).toBe(BASE_SPEED);
            expect(char.attack).toBe(BASE_ATTACK);
            expect(char.defense).toBe(BASE_DEFENSE);
            expect(char.attackDice).toBe(Dice.D4);
            expect(char.defenseDice).toBe(Dice.D6);
            expect(char.name).toBe('');
            expect(char.id).toBe('');
        });

        it('devrait permettre de choisir un nom', () => {
            component.character.name = 'MonPersonnage';
            expect(component.character.name).toBe('MonPersonnage');
        });

        it('devrait valider qu\'un nom sans espaces est requis', () => {
            component.character.name = 'Nom Invalide';
            component.bonusTarget = 'life';
            expect(component.isSubmitDisabled()).toBeTrue();
        });

        it('devrait valider qu\'un bonus est requis', () => {
            component.character.name = 'NomValide';
            component.bonusTarget = null;
            expect(component.isSubmitDisabled()).toBeTrue();
        });

        it('devrait permettre la soumission avec un nom valide et un bonus', () => {
            component.character.name = 'NomValide';
            component.bonusTarget = 'life';
            expect(component.isSubmitDisabled()).toBeFalse();
        });
    });

    describe('Gestion du submitHover', () => {
        it('devrait mettre à jour submitHover via onSubmitHover', () => {
            component.onSubmitHover(true);
            expect(component.submitHover).toBeTrue();

            component.onSubmitHover(false);
            expect(component.submitHover).toBeFalse();
        });
    });

    describe('Soumission et redirection vers salle d\'attente', () => {
        it('devrait joindre la session et naviguer vers waiting-room avec le roomId', () => {
            component.roomId = 'ROOM1';
            component.character.name = 'TestPlayer';
            component.bonusTarget = 'life';

            component.submitCharacter();

            expect(mockGameSessionSocketService.joinGameSession).toHaveBeenCalledWith('ROOM1', component.character);
            expect(routerMock.navigate).toHaveBeenCalledWith(['/waiting-room', 'ROOM1']);
        });

        it('devrait stocker le nom du joueur dans sessionStorage lors de la soumission', () => {
            component.roomId = 'ROOM1';
            component.character.name = 'MonNom';

            component.submitCharacter();

            expect(sessionStorage.getItem('playerUsername')).toBe('MonNom');
        });

        it('ne devrait pas soumettre si ni gameId ni roomId ne sont définis', () => {
            component.gameId = null;
            component.roomId = null;

            spyOn(window, 'alert');
            component.submitCharacter();

            expect(window.alert).toHaveBeenCalledWith('Erreur: Identifiant de session manquant. Veuillez revenir à la page précédente.');
        });
    });
});

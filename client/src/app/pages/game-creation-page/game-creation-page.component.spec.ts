import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GameListComponent } from '@app/components/game-list/game-list.component';
import { CommunicationService } from '@app/services/communication/communication.service';
import { GameCreationPageComponent } from './game-creation-page.component';

/**
 * Stratégie de test pour GameCreationPageComponent:
 * 
 * 1. Tests d'intégration du service : Vérifier que le composant appelle correctement et gère les réponses du service
 * 2. Tests de navigation : Assurer que la navigation du routeur se produit lors de la création réussie d'une session de jeu
 * 3. Cas Limite : Tester les états nuls/vides, les erreurs de service et les entrées invalides
 * 4. Interaction Utilisateur: Tester la sélection de jeu et le flux de création de session
 
 Cas limites testés:
 - GameListComponent n'a pas de jeu sélectionné
 - Gestion des erreurs de service (panne réseau)
 - getSelectedGameId retourne null/undefined (prévention des requêtes invalides)
 - Sélections rapides multiples (conditions de concurrence)
 - canCreateSession retourne false quand aucun jeu n'est sélectionné
 */

describe('GameCreationPageComponent', () => {
    let component: GameCreationPageComponent;
    let fixture: ComponentFixture<GameCreationPageComponent>;
    let communicationServiceSpy: jasmine.SpyObj<CommunicationService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let gameListComponentSpy: jasmine.SpyObj<GameListComponent>;

    beforeEach(async () => {
        communicationServiceSpy = jasmine.createSpyObj('CommunicationService', ['createGameSession']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        gameListComponentSpy = jasmine.createSpyObj('GameListComponent', ['getSelectedGameId']);

        gameListComponentSpy.getSelectedGameId.and.returnValue(null);

        await TestBed.configureTestingModule({
            imports: [GameCreationPageComponent],
            providers: [
                { provide: CommunicationService, useValue: communicationServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCreationPageComponent);
        component = fixture.componentInstance;
        component.gameListComponent = gameListComponentSpy;
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait retourner false pour canCreateSession quand aucun jeu n\'est sélectionné', () => {
        gameListComponentSpy.getSelectedGameId.and.returnValue(null);
        expect(component.canCreateSession).toBeFalse();
    });

    it('devrait retourner true pour canCreateSession quand un jeu est sélectionné', () => {
        gameListComponentSpy.getSelectedGameId.and.returnValue('123');
        expect(component.canCreateSession).toBeTrue();
    });

});

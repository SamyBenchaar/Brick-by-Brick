import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSessionListComponent } from '@app/components/game-session-list/game-session-list.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { JoinGamePageComponent } from './join-game-page.component';

/**
 * Stratégie de test pour JoinGamePageComponent:
 * 
 * 1. Tests d'intégration du service : Vérifier que le composant appelle correctement et gère les réponses du service
 * 2. Tests de navigation : Assurer que la navigation du routeur se produit lorsque l'on rejoint une session de jeu
 * 3. Cas Limite : Tester quand GameSessionListComponent n'a pas de session sélectionnée
 */

describe('JoinGamePageComponent', () => {
    let component: JoinGamePageComponent;
    let fixture: ComponentFixture<JoinGamePageComponent>;
    let gameSessionSocketServiceSpy: jasmine.SpyObj<GameSessionSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let gameSessionListComponentSpy: jasmine.SpyObj<GameSessionListComponent>;

    beforeEach(async () => {
        gameSessionSocketServiceSpy = jasmine.createSpyObj('GameSessionSocketService', ['createGameSession']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        gameSessionListComponentSpy = jasmine.createSpyObj('GameSessionListComponent', ['selectedGameSessionId']);


        await TestBed.configureTestingModule({
            imports: [JoinGamePageComponent],
            providers: [
                { provide: GameSessionSocketService, useValue: gameSessionSocketServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(JoinGamePageComponent);
        component = fixture.componentInstance;
        component.gameSessionListComponent = gameSessionListComponentSpy;
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait retourner false pour canJoinGameSession quand aucune partie n\'est sélectionnée', () => {
        gameSessionListComponentSpy.selectedGameSessionId.and.returnValue(null);
        expect(component.canJoinGameSession()).toBeFalse();
    });

    it('devrait retourner true pour canJoinGameSession quand une partie est sélectionnée', () => {
        gameSessionListComponentSpy.selectedGameSessionId.and.returnValue('123');
        expect(component.canJoinGameSession()).toBeTrue();
    });

    it('ne devrait pas naviguer si aucune session n\'est sélectionnée', () => {
        gameSessionListComponentSpy.selectedGameSessionId.and.returnValue(null);

        component.join();

        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('devrait naviguer vers character-creation avec le bon roomId quand une session est sélectionnée', () => {
        gameSessionListComponentSpy.selectedGameSessionId.and.returnValue('123');

        component.join();

        expect(routerSpy.navigate).toHaveBeenCalledWith(
            ['/character-creation'],
            { queryParams: { roomId: '123' } },
        );
    });

});

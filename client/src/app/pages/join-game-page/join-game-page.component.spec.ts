import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSessionListComponent } from '@app/components/game-session-list/game-session-list.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket/game-session-socket.service';
import { JoinGamePageComponent } from './join-game-page.component';

/**
 * Stratégie de test pour JoinGamePageComponent (jointure):
 *
 * 1. Préconditions de jointure : bouton joignable seulement si une session est sélectionnée.
 * 2. Navigation de jointure : redirection vers la création de personnage avec le roomId choisi.
 * 3. Cas limites : aucune navigation si aucune session, si le composant de liste n'est pas initialisé, ou roomId absent.
 */

describe('JoinGamePageComponent', () => {
    let component: JoinGamePageComponent;
    let fixture: ComponentFixture<JoinGamePageComponent>;
    let gameSessionSocketServiceSpy: jasmine.SpyObj<GameSessionSocketService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let gameSessionListComponentSpy: Partial<GameSessionListComponent>;
    let selectedId: WritableSignal<string | null>;

    beforeEach(async () => {
        gameSessionSocketServiceSpy = jasmine.createSpyObj('GameSessionSocketService', ['createGameSession']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        selectedId = signal<string | null>(null);
        gameSessionListComponentSpy = {
            selectedGameSessionId: selectedId,
            isSelectedAvailable: () => !!selectedId(),
        };

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
        component.gameSessionListComponent = gameSessionListComponentSpy as GameSessionListComponent;
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait retourner false pour canJoinGameSession quand aucune partie n\'est sélectionnée', () => {
        selectedId.set(null);
        expect(component.canJoinGameSession()).toBeFalse();
    });

    it('devrait retourner true pour canJoinGameSession quand une partie est sélectionnée', () => {
        selectedId.set('123');
        expect(component.canJoinGameSession()).toBeTrue();
    });

    it('ne devrait pas naviguer si aucune session n\'est sélectionnée', () => {
        selectedId.set(null);

        component.join();

        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('devrait naviguer vers character-creation avec le bon roomId quand une session est sélectionnée', () => {
        selectedId.set('123');

        component.join();

        expect(routerSpy.navigate).toHaveBeenCalledWith(
            ['/character-creation'],
            { queryParams: { roomId: '123' } },
        );
    });

    it('devrait retourner false pour canJoinGameSession si le gameSessionListComponent n\'est pas initialisé', () => {
        component.gameSessionListComponent = undefined as unknown as GameSessionListComponent;
        expect(component.canJoinGameSession()).toBeFalse();
    });

    it('ne devrait pas naviguer si le gameSessionListComponent n\'est pas initialisé lors du join', () => {
        component.gameSessionListComponent = undefined as unknown as GameSessionListComponent;
        component.join();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('devrait permettre de rejoindre une partie avec un roomId différent', () => {
        selectedId.set('ABC123');

        component.join();

        expect(routerSpy.navigate).toHaveBeenCalledWith(
            ['/character-creation'],
            { queryParams: { roomId: 'ABC123' } },
        );
    });

});

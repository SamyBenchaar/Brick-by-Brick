import { CommonModule } from '@angular/common';
import { Component, Input, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { makeTestSession } from '@app/testing/game-session-test-helpers';
import { WaitingRoomPage } from './waiting-room-page.component';

/**
 * Stratégie de test pour WaitingRoomPage (jointure/salle d'attente):
 *
 * 1. Initialisation : connexion socket, récupération du roomId (priorité route puis session) et du username (sessionStorage ou valeur par défaut).
 * 2. Sortie utilisateur : quitter la salle à tout moment puis retour /home.
 * 3. Données dérivées avec cas limites : roomId/hostId cohérents quand la session est absente ou vide (retourne chaîne vide), hostId issu du premier joueur.
 */

@Component({ selector: 'app-chat', template: '' })
class MockChatComponent {
    @Input() username = '';
    @Input() gameId = '';
    @Input() hostPlayerId = '';
}

@Component({ selector: 'app-waiting-room-list', template: '' })
class MockWaitingRoomListComponent {}

describe('WaitingRoomPage', () => {
    let component: WaitingRoomPage;
    let fixture: ComponentFixture<WaitingRoomPage>;
    let mockGameSessionSocketService: Record<string, unknown>;
    let currentSessionSignal: WritableSignal<GameSession | null>;
    let routerMock: jasmine.SpyObj<Router>;

    const mockSession: GameSession = makeTestSession({
        roomId: 'ROOM1',
        status: 'waiting',
        playerCount: 2,
        maxPlayers: 4,
        hostId: 'host-1',
        playerNames: ['Host', 'P2'],
        avatarIds: [1, 2],
    });

    beforeEach(async () => {
        currentSessionSignal = signal<GameSession | null>(mockSession);
        mockGameSessionSocketService = {
            connect: jasmine.createSpy('connect'),
            leaveGameSession: jasmine.createSpy('leaveGameSession'),
            currentSession: currentSessionSignal,
        };

        routerMock = jasmine.createSpyObj('Router', ['navigate']);

        await TestBed.configureTestingModule({
            imports: [WaitingRoomPage],
            providers: [
                { provide: GameSessionSocketService, useValue: mockGameSessionSocketService },
                { provide: Router, useValue: routerMock },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { params: { gameId: 'ROOM1' } } },
                },
            ],
        })
            .overrideComponent(WaitingRoomPage, {
                set: { imports: [MockChatComponent, MockWaitingRoomListComponent, CommonModule] },
            })
            .compileComponents();

        fixture = TestBed.createComponent(WaitingRoomPage);
        component = fixture.componentInstance;
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait connecter le socket au init', () => {
        component.ngOnInit();
        expect(mockGameSessionSocketService.connect).toHaveBeenCalled();
    });

    it('devrait récupérer le roomId depuis les paramètres de route', () => {
        component.ngOnInit();
        expect(component.roomIdFromRoute).toBe('ROOM1');
    });

    it('devrait retourner le roomId de la route en priorité', () => {
        component.ngOnInit();
        expect(component.roomId).toBe('ROOM1');
    });

    it('devrait retourner le roomId de la session si pas de route', () => {
        component.roomIdFromRoute = '';
        expect(component.roomId).toBe('ROOM1');
    });

    it('devrait retourner le hostId du premier joueur', () => {
        expect(component.hostId).toBe('host-1');
    });

    it('devrait récupérer le username depuis sessionStorage', () => {
        sessionStorage.setItem('playerUsername', 'TestUser');
        component.ngOnInit();
        expect(component.username).toBe('TestUser');
    });

    it('devrait quitter la salle et naviguer vers /home', () => {
        component.leave();
        expect(mockGameSessionSocketService.leaveGameSession).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('devrait utiliser le username par défaut "Player" si sessionStorage est vide', () => {
        sessionStorage.removeItem('playerUsername');
        component.ngOnInit();
        expect(component.username).toBe('Player');
    });

    it('devrait retourner une chaîne vide pour roomId si pas de route ni de session', () => {
        component.roomIdFromRoute = '';
        currentSessionSignal.set(null);
        expect(component.roomId).toBe('');
    });

    it('devrait retourner une chaîne vide pour hostId si pas de session', () => {
        currentSessionSignal.set(null);
        expect(component.hostId).toBe('');
    });

    it('devrait retourner une chaîne vide pour hostId si la session n\'a pas de joueurs', () => {
        const emptySession = {
            ...mockSession,
            players: [],
        } as unknown as GameSession;
        currentSessionSignal.set(emptySession);
        expect(component.hostId).toBe('');
    });

});

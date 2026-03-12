import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Character } from '@common/character';
import { WaitingRoomPage } from './waiting-room-page.component';

/**
 * Stratégie de test pour WaitingRoomPage:
 *
 * 1. Initialisation : Connexion socket, récupération du roomId et du username
 * 2. Quitter la salle : Appel leaveGameSession et navigation vers /home
 * 3. Propriétés dérivées : roomId et hostId depuis la session courante
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
    let routerMock: jasmine.SpyObj<Router>;

    const mockSession: GameSession = {
        roomId: 'ROOM1',
        status: 'waiting',
        maxPlayers: 4,
        players: [
            { socketId: 'host-1', character: { name: 'Host' } as Character },
            { socketId: 'p2', character: { name: 'P2' } as Character },
        ],
        host: { socketId: 'host-1', character: { name: 'Host' } as Character },
    } as unknown as GameSession;

    beforeEach(async () => {
        mockGameSessionSocketService = {
            connect: jasmine.createSpy('connect'),
            leaveGameSession: jasmine.createSpy('leaveGameSession'),
            currentSession: signal<GameSession | null>(mockSession),
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
        (mockGameSessionSocketService.currentSession as any).set(null);
        expect(component.roomId).toBe('');
    });

    it('devrait retourner une chaîne vide pour hostId si pas de session', () => {
        (mockGameSessionSocketService.currentSession as any).set(null);
        expect(component.hostId).toBe('');
    });

    it('devrait retourner une chaîne vide pour hostId si la session n\'a pas de joueurs', () => {
        const emptySession = {
            ...mockSession,
            players: [],
        } as unknown as GameSession;
        (mockGameSessionSocketService.currentSession as any).set(emptySession);
        expect(component.hostId).toBe('');
    });

    it('devrait pouvoir quitter la vue d\'attente à tout moment vers la vue initiale', () => {
        component.leave();
        expect(mockGameSessionSocketService.leaveGameSession).toHaveBeenCalled();
        expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
    });
});

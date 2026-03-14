import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Character } from '@common/character';
import { WaitingRoomListComponent } from './waiting-room-list.component';

/**
 * Stratégie de test pour WaitingRoomListComponent:
 *
 * 1. Affichage en salle d'attente : noms et avatars des joueurs
 * 2. Identification : hôte et joueur courant correctement reconnus
 * 3. Cohérence d'affichage : valeurs par défaut sûres (nom/avatar) en cas de données manquantes
 */
describe('WaitingRoomListComponent', () => {
    let component: WaitingRoomListComponent;
    let fixture: ComponentFixture<WaitingRoomListComponent>;
    let mockService: Record<string, unknown>;
    let currentSessionSignal: WritableSignal<GameSession | null>;

    const PLAYER_COUNT = 2;
    const MAX_PLAYERS = 4;

    const hostChar: Character = { name: 'Host', avatarId: 1 } as Character;
    const playerChar: Character = { name: 'Player2', avatarId: 3 } as Character;

    const mockSession: GameSession = {
        roomId: 'ROOM1',
        status: 'waiting',
        maxPlayers: 4,
        players: [
            { socketId: 'host-1', character: hostChar },
            { socketId: 'p2', character: playerChar },
        ],
        host: { socketId: 'host-1', character: hostChar },
    } as unknown as GameSession;

    beforeEach(async () => {
        currentSessionSignal = signal<GameSession | null>(mockSession);
        mockService = {
            currentSession: currentSessionSignal,
            isCurrentUserHost: jasmine.createSpy('isCurrentUserHost').and.returnValue(true),
            canStartGame: jasmine.createSpy('canStartGame').and.returnValue(true),
            isPlayerHost: jasmine.createSpy('isPlayerHost').and.callFake((id: string) => id === 'host-1'),
            getSocketId: jasmine.createSpy('getSocketId').and.returnValue('host-1'),
            kickPlayer: jasmine.createSpy('kickPlayer'),
            startGame: jasmine.createSpy('startGame'),
        };

        await TestBed.configureTestingModule({
            imports: [WaitingRoomListComponent],
            providers: [
                { provide: GameSessionSocketService, useValue: mockService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(WaitingRoomListComponent);
        component = fixture.componentInstance;
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait détecter si le joueur courant est l\'hôte', () => {
        expect(component.isCurrentUserHost()).toBeTrue();
    });

    it('devrait identifier un joueur comme hôte', () => {
        expect(component.isPlayerHost('host-1')).toBeTrue();
        expect(component.isPlayerHost('p2')).toBeFalse();
    });

    it('devrait identifier le joueur courant', () => {
        expect(component.isSelf('host-1')).toBeTrue();
        expect(component.isSelf('p2')).toBeFalse();
    });

    it('devrait retourner le nom du personnage', () => {
        expect(component.getCharacterName(hostChar)).toBe('Host');
    });

    it('devrait retourner "Joueur" si le personnage est null', () => {
        expect(component.getCharacterName(null as unknown as Character)).toBe('Joueur');
    });

    it('devrait retourner l\'image de l\'avatar', () => {
        const image = component.getAvatarImage(hostChar);
        expect(image).toContain('lily');
    });

    it('devrait retourner l\'image par défaut pour un avatar inconnu', () => {
        const unknown = { avatarId: 999 } as Character;
        const image = component.getAvatarImage(unknown);
        expect(image).toContain('lily');
    });

    it('devrait pouvoir démarrer la partie', () => {
        expect(component.canStartGame()).toBeTrue();
    });

    it('devrait appeler kickPlayer du service', () => {
        component.onKick('p2');
        expect(mockService.kickPlayer).toHaveBeenCalledWith('p2');
    });

    it('devrait appeler startGame du service', () => {
        component.startGame();
        expect(mockService.startGame).toHaveBeenCalled();
    });

    it('devrait retourner false pour isCurrentUserHost quand le joueur n\'est pas l\'hôte', () => {
        (mockService.isCurrentUserHost as jasmine.Spy).and.returnValue(false);
        expect(component.isCurrentUserHost()).toBeFalse();
    });

    it('devrait retourner false pour canStartGame quand il n\'y a pas assez de joueurs', () => {
        (mockService.canStartGame as jasmine.Spy).and.returnValue(false);
        expect(component.canStartGame()).toBeFalse();
    });

    it('devrait afficher le nombre correct de joueurs dans la session', () => {
        const session = currentSessionSignal();
        expect(session?.players.length).toBe(PLAYER_COUNT);
        expect(session?.maxPlayers).toBe(MAX_PLAYERS);
    });

    it('devrait permettre d\'exclure un joueur non-hôte', () => {
        component.onKick('p2');
        expect(mockService.kickPlayer).toHaveBeenCalledWith('p2');
    });

    it('devrait retourner l\'image par défaut pour un personnage null', () => {
        const image = component.getAvatarImage(null as unknown as Character);
        expect(image).toContain('lily');
    });

    it('devrait retourner "Joueur" pour un personnage sans nom', () => {
        const noNameChar = { name: undefined } as unknown as Character;
        expect(component.getCharacterName(noNameChar)).toBe('Joueur');
    });
});

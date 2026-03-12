import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Character } from '@common/character';
import { GameSessionListComponent } from './game-session-list.component';

/**
 * Stratégie de test pour GameSessionListComponent:
 *
 * 1. Affichage : Vérifier que les sessions disponibles sont affichées
 * 2. Filtrage : Seules les sessions en attente avec places disponibles sont montrées
 * 3. Sélection : Sélectionner et vérifier la session sélectionnée
 * 4. Mise à jour dynamique : Vérifier que le signal réactif filtre correctement
 */
describe('GameSessionListComponent', () => {
    let component: GameSessionListComponent;
    let fixture: ComponentFixture<GameSessionListComponent>;
    let mockGameSessionSocketService: jasmine.SpyObj<GameSessionSocketService>;

    const createMockSession = (roomId: string, status: 'waiting' | 'playing', playerCount: number, maxPlayers = 4): GameSession => ({
        roomId,
        status,
        maxPlayers,
        players: Array.from({ length: playerCount }, (_, i) => ({
            socketId: `p${i}`,
            character: { name: `Player${i}` } as Character,
        })),
        host: { socketId: 'p0', character: { name: 'Player0' } as Character },
    } as unknown as GameSession);

    beforeEach(async () => {
        // Mock le service avec un signal writable pour gameSessions
        const { signal } = await import('@angular/core');
        const gameSessionsSignal = signal<GameSession[]>([]);

        mockGameSessionSocketService = jasmine.createSpyObj('GameSessionSocketService', ['connect', 'disconnect'], {
            gameSessions: gameSessionsSignal,
        });

        await TestBed.configureTestingModule({
            imports: [GameSessionListComponent],
            providers: [
                { provide: GameSessionSocketService, useValue: mockGameSessionSocketService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GameSessionListComponent);
        component = fixture.componentInstance;
    });

    it('devrait créer le composant', () => {
        expect(component).toBeTruthy();
    });

    it('devrait connecter le socket au init', () => {
        component.ngOnInit();
        expect(mockGameSessionSocketService.connect).toHaveBeenCalled();
    });

    it('devrait filtrer les sessions en attente avec places disponibles', () => {
        const waiting = createMockSession('R1', 'waiting', 2);
        const playing = createMockSession('R2', 'playing', 2);
        const full = createMockSession('R3', 'waiting', 4, 4);

        (mockGameSessionSocketService.gameSessions as any).set([waiting, playing, full]);

        const available = component.availableGameSessions();
        expect(available.length).toBe(1);
        expect(available[0].roomId).toBe('R1');
    });

    it('devrait retourner une liste vide si aucune session disponible', () => {
        (mockGameSessionSocketService.gameSessions as any).set([]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait sélectionner une session', () => {
        component.selectGameSession('ROOM1');
        expect(component.selectedGameSessionId()).toBe('ROOM1');
    });

    it('devrait identifier la session sélectionnée', () => {
        component.selectGameSession('ROOM1');
        expect(component.isSelected('ROOM1')).toBeTrue();
        expect(component.isSelected('ROOM2')).toBeFalse();
    });

    it('devrait afficher le nombre de joueurs dans chaque session disponible', () => {
        const s1 = createMockSession('R1', 'waiting', 2);
        const s2 = createMockSession('R2', 'waiting', 3);
        (mockGameSessionSocketService.gameSessions as any).set([s1, s2]);

        const available = component.availableGameSessions();
        expect(available[0].players.length).toBe(2);
        expect(available[1].players.length).toBe(3);
    });

    it('devrait mettre à jour la liste quand les sessions changent', () => {
        const s1 = createMockSession('R1', 'waiting', 1);
        (mockGameSessionSocketService.gameSessions as any).set([s1]);
        expect(component.availableGameSessions().length).toBe(1);

        // Simuler que la session est maintenant pleine
        const s1Full = createMockSession('R1', 'waiting', 4, 4);
        (mockGameSessionSocketService.gameSessions as any).set([s1Full]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait exclure les sessions qui passent à l\'état playing', () => {
        const waiting = createMockSession('R1', 'waiting', 2);
        (mockGameSessionSocketService.gameSessions as any).set([waiting]);
        expect(component.availableGameSessions().length).toBe(1);

        // La session passe à 'playing'
        const playing = createMockSession('R1', 'playing', 2);
        (mockGameSessionSocketService.gameSessions as any).set([playing]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait exclure les sessions avec 0 place disponible (maxPlayers atteint)', () => {
        const full = createMockSession('R1', 'waiting', 6, 6);
        (mockGameSessionSocketService.gameSessions as any).set([full]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait inclure uniquement les sessions en attente avec au moins 1 place', () => {
        const s1 = createMockSession('R1', 'waiting', 1, 4);
        const s2 = createMockSession('R2', 'playing', 2, 4);
        const s3 = createMockSession('R3', 'waiting', 4, 4);
        const s4 = createMockSession('R4', 'waiting', 3, 4);
        (mockGameSessionSocketService.gameSessions as any).set([s1, s2, s3, s4]);

        const available = component.availableGameSessions();
        expect(available.length).toBe(2);
        expect(available.map(s => s.roomId)).toEqual(['R1', 'R4']);
    });

    it('devrait permettre de changer la session sélectionnée', () => {
        component.selectGameSession('ROOM1');
        expect(component.selectedGameSessionId()).toBe('ROOM1');

        component.selectGameSession('ROOM2');
        expect(component.selectedGameSessionId()).toBe('ROOM2');
    });

    it('devrait réinitialiser la sélection si la session sélectionnée n\'est plus disponible', () => {
        const s1 = createMockSession('R1', 'waiting', 1);
        (mockGameSessionSocketService.gameSessions as any).set([s1]);
        component.selectGameSession('R1');
        expect(component.isSelected('R1')).toBeTrue();

        // La session est supprimée de la liste
        (mockGameSessionSocketService.gameSessions as any).set([]);

        // L'ID sélectionné reste en mémoire mais la session n'est plus dans availableGameSessions
        const available = component.availableGameSessions();
        expect(available.length).toBe(0);
    });

    it('devrait mettre à jour dynamiquement quand une nouvelle session est ajoutée', () => {
        (mockGameSessionSocketService.gameSessions as any).set([]);
        expect(component.availableGameSessions().length).toBe(0);

        const s1 = createMockSession('R1', 'waiting', 1);
        (mockGameSessionSocketService.gameSessions as any).set([s1]);
        expect(component.availableGameSessions().length).toBe(1);
    });
});

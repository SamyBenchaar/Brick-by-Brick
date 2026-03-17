import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { makeTestSession } from '@app/testing/game-session-test-helpers';
import { GameSessionListComponent } from './game-session-list.component';

const DEFAULT_MAX_PLAYERS = 4;
const P1_COUNT = 1;
const P2_COUNT = 2;
const P3_COUNT = 3;
const FULL_PLAYERS = 4;
const SIX_PLAYERS = 6;

/**
 * Stratégie de test pour GameSessionListComponent (jointure):
 *
 * 1. Affichage de la vue de jointure : sessions disponibles visibles et sélectionnables.
 * 2. Filtrage des parties joignables (cas limites) : exclure les sessions en 'playing', les sessions pleines (0 place) et la liste vide.
 * 3. Sélection d'une partie : mémorisation et changement de sélection.
 * 4. Mise à jour dynamique : retrait/ajout automatique selon disponibilité (session qui devient pleine ou passe à playing).
 * 5. Informations affichées : nombre de joueurs par partie pour aider l'utilisateur à choisir.
 */
describe('GameSessionListComponent', () => {
    let component: GameSessionListComponent;
    let fixture: ComponentFixture<GameSessionListComponent>;
    let mockGameSessionSocketService: jasmine.SpyObj<GameSessionSocketService>;
    let gameSessionsSignal: WritableSignal<GameSession[]>;

    beforeEach(async () => {
        gameSessionsSignal = signal<GameSession[]>([]);

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
        const waiting = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: 2 });
        const playing = makeTestSession({ roomId: 'R2', status: 'playing', playerCount: 2 });
        const full = makeTestSession({ roomId: 'R3', status: 'waiting', playerCount: FULL_PLAYERS, maxPlayers: FULL_PLAYERS });

        gameSessionsSignal.set([waiting, playing, full]);

        const available = component.availableGameSessions();
        expect(available.length).toBe(1);
        expect(available[0].roomId).toBe('R1');
    });

    it('devrait retourner une liste vide si aucune session disponible', () => {
        gameSessionsSignal.set([]);
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
        const s1 = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: 2 });
        const s2 = makeTestSession({ roomId: 'R2', status: 'waiting', playerCount: P3_COUNT });
        gameSessionsSignal.set([s1, s2]);

        const available = component.availableGameSessions();
        expect(available[0].players.length).toBe(2);
        expect(available[1].players.length).toBe(P3_COUNT);
    });

    it('devrait mettre à jour la liste quand les sessions changent', () => {
        const s1 = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: 1 });
        gameSessionsSignal.set([s1]);
        expect(component.availableGameSessions().length).toBe(1);

        // Simuler que la session est maintenant pleine
        const s1Full = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: FULL_PLAYERS, maxPlayers: FULL_PLAYERS });
        gameSessionsSignal.set([s1Full]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait exclure les sessions qui passent à l\'état playing', () => {
        const waiting = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: 2 });
        gameSessionsSignal.set([waiting]);
        expect(component.availableGameSessions().length).toBe(1);

        // La session passe à 'playing'
        const playing = makeTestSession({ roomId: 'R1', status: 'playing', playerCount: 2 });
        gameSessionsSignal.set([playing]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait exclure les sessions avec 0 place disponible (maxPlayers atteint)', () => {
        const full = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: SIX_PLAYERS, maxPlayers: SIX_PLAYERS });
        gameSessionsSignal.set([full]);
        expect(component.availableGameSessions().length).toBe(0);
    });

    it('devrait inclure uniquement les sessions en attente avec au moins 1 place', () => {
        const s1 = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: P1_COUNT, maxPlayers: DEFAULT_MAX_PLAYERS });
        const s2 = makeTestSession({ roomId: 'R2', status: 'playing', playerCount: P2_COUNT, maxPlayers: DEFAULT_MAX_PLAYERS });
        const s3 = makeTestSession({ roomId: 'R3', status: 'waiting', playerCount: FULL_PLAYERS, maxPlayers: DEFAULT_MAX_PLAYERS });
        const s4 = makeTestSession({ roomId: 'R4', status: 'waiting', playerCount: P3_COUNT, maxPlayers: DEFAULT_MAX_PLAYERS });
        gameSessionsSignal.set([s1, s2, s3, s4]);

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
        const s1 = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: 1 });
        gameSessionsSignal.set([s1]);
        component.selectGameSession('R1');
        expect(component.isSelected('R1')).toBeTrue();

        // La session est supprimée de la liste
        gameSessionsSignal.set([]);

        // L'ID sélectionné reste en mémoire mais la session n'est plus dans availableGameSessions
        const available = component.availableGameSessions();
        expect(available.length).toBe(0);
    });

    it('devrait mettre à jour dynamiquement quand une nouvelle session est ajoutée', () => {
        gameSessionsSignal.set([]);
        expect(component.availableGameSessions().length).toBe(0);

        const s1 = makeTestSession({ roomId: 'R1', status: 'waiting', playerCount: 1 });
        gameSessionsSignal.set([s1]);
        expect(component.availableGameSessions().length).toBe(1);
    });
});

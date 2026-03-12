import { TestBed } from '@angular/core/testing';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { GameSessionSocketService } from './game-session-socket.service';
import { SocketService } from './socket.service';

/**
 * Stratégie de test pour GameSessionSocketService:
 *
 * 1. Tests d'intégration avec SocketService: Vérifier que le service gère correctement les événements socket
 *    en écoutant et en mettant à jour le signal des parties
 * 2. Tests du cycle de vie: Assurer la connexion, la configuration des écouteurs et la déconnexion
 * 3. Gestion des événements socket: Tester la réception et le traitement des événements principaux
 *    (GameSessionList, GameSessionCreated, GameSessionUpdated, GameSessionDeleted, RoomCancelled, etc.)
 * 4. Intégrité du signal réactif: Valider que les modifications du signal déclenchent les mises à jour correctes
 * 5. Isolation des dépendances: Utiliser des mocks Jasmine pour isoler SocketService
 *
 * Cas limites testés:
 * to DO
 */

const MAX_PLAYERS = 4;

describe('GameSessionSocketService', () => {
    let service: GameSessionSocketService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;

    const mockPlayer = {
        socketId: 'socket1',
        character: {
            name: 'Player',
            avatarId: 1,
            speed: 5,
        } as unknown as Character,
    };

    const mockPlayer2 = {
        socketId: 'socket2',
        character: {
            name: 'Player',
            avatarId: 2,
            speed: 4,
        } as unknown as Character,
    };

    const mockGameSession: GameSession = {
        players: [],
        leftPlayers: [],
        status: 'waiting',
        roomId: 'room1',
        maxPlayers: MAX_PLAYERS,
        mapId: 'map1',
        mapCopy: null,
        host: mockPlayer,
        takenAvatars: [],
    } as unknown as GameSession;

    const mockGameSession2: GameSession = {
        players: [],
        leftPlayers: [],
        status: 'waiting',
        roomId: 'room2',
        maxPlayers: MAX_PLAYERS,
        mapId: 'map1',
        mapCopy: null,
        host: mockPlayer2,
        takenAvatars: [],
    } as unknown as GameSession;

    beforeEach(() => {
        socketServiceMock = jasmine.createSpyObj('SocketService', [
            'connect',
            'disconnect',
            'on',
            'off',
            'emit',
            'isConnected',
            'getSocketId',
        ]);

        TestBed.configureTestingModule({
            providers: [GameSessionSocketService, { provide: SocketService, useValue: socketServiceMock }],
        });
        service = TestBed.inject(GameSessionSocketService);
    });

    describe('Initialisation de la connexion', () => {
        it('devrait connecter le service socket lors de la connexion', () => {
            service.connect();

            expect(socketServiceMock.connect).toHaveBeenCalled();
        });

        it('devrait demander la liste des parties avec des places de libre lors de la connexion', () => {
            service.connect();

            expect(socketServiceMock.emit).toHaveBeenCalledWith(GameSessionEvents.RequestGameSessionList);
        });

        it('devrait configurer les écouteurs d\'événements lors de la connexion', () => {
            service.connect();

            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionList,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionListUpdated,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionCreated,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionUpdated,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionDeleted,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionJoinError,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.PlayerKicked,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.RoomCancelled,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.GameStarted,
                jasmine.any(Function),
            );
            expect(socketServiceMock.on).toHaveBeenCalledWith(
                GameSessionEvents.AvatarTakenUpdated,
                jasmine.any(Function),
            );
        });
    });

    describe('Réception de la liste des parties', () => {
        it('devrait mettre à jour le signal des parties lors de la réception de GameSessionList', () => {
            const mockGameSessions = [mockGameSession, mockGameSession2];

            service.connect();

            const callbackGameList = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameSessionEvents.GameSessionList)?.args[1] as (gameSessions: GameSession[]) => void;

            callbackGameList(mockGameSessions);

            expect(service.gameSessions()).toEqual(mockGameSessions);
        });

        it('devrait contenir deux parties après la réception de la liste', () => {
            const mockGameSessions = [mockGameSession, mockGameSession2];

            service.connect();

            const callbackGameList = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameSessionEvents.GameSessionList)?.args[1] as (gameSessions: GameSession[]) => void;

            callbackGameList(mockGameSessions);

            expect(service.gameSessions().length).toBe(2);
        });
    });

    describe('Création d\'une partie', () => {
        it('devrait ajouter une nouvelle partie à la liste lors de GameSessionCreated', () => {
            service.gameSessions.set([mockGameSession]);

            service.connect();

            const callbackGameCreated = socketServiceMock.on.calls
                .all()
                .find((call) => call.args[0] === GameSessionEvents.GameSessionCreated)?.args[1] as (gameSession: GameSession) => void;

            callbackGameCreated(mockGameSession2);

            const gameSessions = service.gameSessions();
            expect(gameSessions.length).toBe(2);
            expect(gameSessions[1]).toEqual(mockGameSession2);
        });
    });

    describe('Mise à jour d\'une partie', () => {
        it('ne devrait pas augmenter le nombre de sessions lors d\'une mise à jour', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const updatedGameSession = {
                ...mockGameSession,
                takenAvatars: [1],
            } as unknown as GameSession;

            const callbackGameUpdated = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionUpdated)
                ?.args[1] as (gameSession: GameSession) => void;

            callbackGameUpdated(updatedGameSession);

            expect(service.gameSessions().length).toBe(2);
        });

    });

    describe('Suppression d\'une partie', () => {
        it('devrait supprimer une partie de la liste lors de GameSessionDeleted', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const callbackGameDeleted = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionDeleted)
                ?.args[1] as (roomId: string) => void;

            callbackGameDeleted('room1');

            const sessions = service.gameSessions();
            expect(sessions.length).toBe(1);
            expect(sessions[0].roomId).toBe('room2');
        });

        it('ne devrait pas supprimer une partie avec un id inexistant', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const callbackGameDeleted = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionDeleted)
                ?.args[1] as (roomId: string) => void;

            callbackGameDeleted('unknown');

            expect(service.gameSessions().length).toBe(2);
        });
    });

    describe('Déconnexion', () => {
        it('devrait arrêter d\'écouter tous les événements lors de la déconnexion', () => {
            service.connect();
            service.disconnect();

            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionList); expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionListUpdated); expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionCreated);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionUpdated);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionDeleted);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.PlayerKicked);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.RoomCancelled);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameStarted);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.AvatarTakenUpdated);
        });

        it('devrait déconnecter le service socket lors de la déconnexion', () => {
            service.connect();
            service.disconnect();

            expect(socketServiceMock.disconnect).toHaveBeenCalled();
        });
    });

    describe('Intégration complète', () => {
        it('devrait gérer plusieurs événements socket successifs', () => {
            service.connect();

            const callbackList = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionList)
                ?.args[1] as (sessions: GameSession[]) => void;

            callbackList([mockGameSession]);
            expect(service.gameSessions().length).toBe(1);

            const callbackCreated = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionCreated)
                ?.args[1] as (session: GameSession) => void;

            callbackCreated(mockGameSession2);
            expect(service.gameSessions().length).toBe(2);

            const callbackDeleted = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionDeleted)
                ?.args[1] as (roomId: string) => void;

            callbackDeleted('room1');

            expect(service.gameSessions().length).toBe(1);
            expect(service.gameSessions()[0].roomId).toBe('room2');
        });
    });
});
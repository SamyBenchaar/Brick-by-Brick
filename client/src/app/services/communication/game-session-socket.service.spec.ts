import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { of } from 'rxjs';
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
    let routerMock: jasmine.SpyObj<Router>;
    let dialogMock: jasmine.SpyObj<MatDialog>;

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

        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        routerMock.navigate.and.returnValue(Promise.resolve(true));
        dialogMock = jasmine.createSpyObj('MatDialog', ['open']);

        TestBed.configureTestingModule({
            providers: [
                GameSessionSocketService,
                { provide: SocketService, useValue: socketServiceMock },
                { provide: Router, useValue: routerMock },
                { provide: MatDialog, useValue: dialogMock },
            ],
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

    describe('Réception des avatars pris', () => {
        it('devrait mettre à jour takenAvatars lors de AvatarTakenUpdated', () => {
            service.connect();

            const callbackAvatarUpdated = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.AvatarTakenUpdated)
                ?.args[1] as (avatarIds: number[]) => void;

            callbackAvatarUpdated([1, 3, 5]);

            expect(service.takenAvatars()).toEqual([1, 3, 5]);
        });

        it('devrait vider takenAvatars quand la liste est vide', () => {
            service.takenAvatars.set([1, 2]);
            service.connect();

            const callbackAvatarUpdated = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.AvatarTakenUpdated)
                ?.args[1] as (avatarIds: number[]) => void;

            callbackAvatarUpdated([]);

            expect(service.takenAvatars()).toEqual([]);
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

    describe('Joindre une partie (joinGameSession)', () => {
        it('devrait émettre l\'événement JoinGameSession avec le roomId et le personnage', () => {
            const character = { name: 'TestPlayer', avatarId: 2 } as Character;
            service.joinGameSession('ROOM1', character);

            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.JoinGameSession,
                { roomId: 'ROOM1', player: character },
            );
        });

        it('devrait stocker le dernier roomId et personnage pour un éventuel retry', () => {
            const character = { name: 'TestPlayer', avatarId: 2 } as Character;
            service.joinGameSession('ROOM1', character);

            // Vérifier que le service stocke les infos pour retry via le mécanisme interne
            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.JoinGameSession,
                jasmine.objectContaining({ roomId: 'ROOM1' }),
            );
        });
    });

    describe('Erreur de jointure (GameSessionJoinError)', () => {
        it('devrait ouvrir un dialog d\'avertissement quand la partie est verrouillée ou pleine', () => {
            const mockDialogRef = { afterClosed: () => of(false) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            service.connect();

            const callbackJoinError = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionJoinError)
                ?.args[1] as (message: string) => void;

            callbackJoinError('La partie est pleine');

            expect(dialogMock.open).toHaveBeenCalled();
            const dialogData = dialogMock.open.calls.mostRecent().args[1]?.data as { title: string; message: string; confirmText: string; cancelText: string };
            expect(dialogData.title).toBe('Salle pleine');
            expect(dialogData.message).toBe('La partie est pleine');
            expect(dialogData.confirmText).toBe('Réessayer');
            expect(dialogData.cancelText).toContain('Retour');
        });

        it('devrait retenter de joindre quand l\'utilisateur choisit Réessayer', () => {
            const mockDialogRef = { afterClosed: () => of(true) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            const character = { name: 'TestPlayer', avatarId: 2 } as Character;
            service.joinGameSession('ROOM1', character);
            socketServiceMock.emit.calls.reset();

            service.connect();

            const callbackJoinError = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionJoinError)
                ?.args[1] as (message: string) => void;

            callbackJoinError('La partie est pleine');

            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.JoinGameSession,
                jasmine.objectContaining({ roomId: 'ROOM1' }),
            );
        });

        it('devrait naviguer vers la vue initiale quand l\'utilisateur choisit Retour', () => {
            const mockDialogRef = { afterClosed: () => of(false) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            service.connect();

            const callbackJoinError = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionJoinError)
                ?.args[1] as (message: string) => void;

            callbackJoinError('Partie verrouillée');

            expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('Observer une partie (observeGameSession)', () => {
        it('devrait émettre l\'événement ObserveGameSession avec le roomId', () => {
            service.observeGameSession('ROOM1');

            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.ObserveGameSession,
                { roomId: 'ROOM1' },
            );
        });
    });

    describe('Mise à jour des avatars pris (updateTakenAvatars)', () => {
        it('devrait émettre l\'événement AvatarTakenUpdated avec le roomId et l\'avatarId', () => {
            service.updateTakenAvatars('ROOM1', 3);

            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.AvatarTakenUpdated,
                { roomId: 'ROOM1', newAvatarId: 3 },
            );
        });
    });

    describe('Quitter une session (leaveGameSession)', () => {
        it('devrait émettre l\'événement LeaveGameSession et réinitialiser la session', () => {
            service.currentSession.set(mockGameSession);

            service.leaveGameSession();

            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.LeaveGameSession,
                { roomId: 'room1' },
            );
            expect(service.currentSession()).toBeNull();
            expect(service.takenAvatars()).toEqual([]);
        });

        it('ne devrait rien émettre si aucune session courante', () => {
            service.currentSession.set(null);

            service.leaveGameSession();

            expect(socketServiceMock.emit).not.toHaveBeenCalledWith(
                GameSessionEvents.LeaveGameSession,
                jasmine.anything(),
            );
        });
    });

    describe('Joueur exclu (PlayerKicked)', () => {
        it('devrait réinitialiser la session et naviguer vers l\'accueil quand un joueur est exclu', async () => {
            const mockDialogRef = { afterClosed: () => of(true) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            service.currentSession.set(mockGameSession);
            service.connect();

            const callbackKicked = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.PlayerKicked)
                ?.args[1] as (data: { message: string }) => void;

            callbackKicked({ message: 'Vous avez été exclu' });

            expect(service.currentSession()).toBeNull();
            expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('Salle annulée (RoomCancelled)', () => {
        it('devrait réinitialiser la session et naviguer vers l\'accueil quand la salle est annulée', async () => {
            const mockDialogRef = { afterClosed: () => of(true) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            service.currentSession.set(mockGameSession);
            service.connect();

            const callbackCancelled = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.RoomCancelled)
                ?.args[1] as (data: { message: string }) => void;

            callbackCancelled({ message: 'La salle a été annulée' });

            expect(service.currentSession()).toBeNull();
            expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('Suppression de la session courante', () => {
        it('devrait réinitialiser currentSession et takenAvatars quand la session courante est supprimée', () => {
            service.currentSession.set(mockGameSession);
            service.takenAvatars.set([1, 2, 3]);

            service.connect();

            const callbackDeleted = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionDeleted)
                ?.args[1] as (roomId: string) => void;

            callbackDeleted('room1');

            expect(service.currentSession()).toBeNull();
            expect(service.takenAvatars()).toEqual([]);
        });
    });

    describe('Mise à jour dynamique de la liste (GameSessionListUpdated)', () => {
        it('devrait mettre à jour la liste complète des sessions lors de GameSessionListUpdated', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const callbackListUpdated = socketServiceMock.on.calls
                .all()
                .find(call => call.args[0] === GameSessionEvents.GameSessionListUpdated)
                ?.args[1] as (sessions: GameSession[]) => void;

            // Simuler que seule la session 2 est encore disponible
            callbackListUpdated([mockGameSession2]);

            expect(service.gameSessions().length).toBe(1);
            expect(service.gameSessions()[0].roomId).toBe('room2');
        });
    });

    describe('Utilitaires du service', () => {
        it('devrait retourner le socketId via getSocketId', () => {
            socketServiceMock.getSocketId.and.returnValue('my-socket-id');
            expect(service.getSocketId()).toBe('my-socket-id');
        });

        it('devrait retourner une chaîne vide si getSocketId retourne undefined', () => {
            socketServiceMock.getSocketId.and.returnValue(undefined);
            expect(service.getSocketId()).toBe('');
        });

        it('devrait retourner l\'état de connexion via isConnected', () => {
            socketServiceMock.isConnected.and.returnValue(true);
            expect(service.isConnected()).toBeTrue();

            socketServiceMock.isConnected.and.returnValue(false);
            expect(service.isConnected()).toBeFalse();
        });

        it('devrait identifier le host courant via isCurrentUserHost', () => {
            socketServiceMock.getSocketId.and.returnValue('socket1');
            service.currentSession.set(mockGameSession);

            expect(service.isCurrentUserHost()).toBeTrue();
        });

        it('devrait retourner false pour isCurrentUserHost si le joueur n\'est pas host', () => {
            socketServiceMock.getSocketId.and.returnValue('socket999');
            service.currentSession.set(mockGameSession);

            expect(service.isCurrentUserHost()).toBeFalse();
        });

        it('devrait identifier un joueur comme host via isPlayerHost', () => {
            service.currentSession.set(mockGameSession);

            expect(service.isPlayerHost('socket1')).toBeTrue();
            expect(service.isPlayerHost('socket999')).toBeFalse();
        });

        it('devrait permettre de démarrer la partie avec 2+ joueurs et en tant que host', () => {
            socketServiceMock.getSocketId.and.returnValue('socket1');
            const sessionWith2Players = {
                ...mockGameSession,
                players: [mockPlayer, mockPlayer2],
            } as unknown as GameSession;
            service.currentSession.set(sessionWith2Players);

            expect(service.canStartGame()).toBeTrue();
        });

        it('ne devrait pas permettre de démarrer avec moins de 2 joueurs', () => {
            socketServiceMock.getSocketId.and.returnValue('socket1');
            const sessionWith1Player = {
                ...mockGameSession,
                players: [mockPlayer],
            } as unknown as GameSession;
            service.currentSession.set(sessionWith1Player);

            expect(service.canStartGame()).toBeFalse();
        });
    });

    describe('Ne pas re-initialiser les listeners', () => {
        it('ne devrait pas configurer les écouteurs deux fois lors de connexions multiples', () => {
            socketServiceMock.isConnected.and.returnValue(false);
            service.connect();
            const firstCallCount = socketServiceMock.on.calls.count();

            socketServiceMock.isConnected.and.returnValue(true);
            service.connect();
            const secondCallCount = socketServiceMock.on.calls.count();

            expect(secondCallCount).toBe(firstCallCount);
        });
    });
});
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { mockGameSession, mockGameSession2, mockPlayer } from '@app/services/communication/game-session-socket/game-session-socket.service.spec.mocks';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { of } from 'rxjs';

const AVATAR_ID_THREE = 3;
const AVATAR_ID_FIVE = 5;

type JoinErrorDialogData = {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
};

/**
 * Stratégie de test pour GameSessionSocketService:
 *
 * 1. Connexion/cycle de vie client : abonnement aux événements de jointure et nettoyage
 * 2. Liste des parties joignables : synchronisation dynamique via événements serveur
 * 3. Jointure de partie : émission JoinGameSession et mémorisation pour retry
 * 4. Gestion d'erreur de jointure : introuvable, pleine ou commencée, choix Réessayer ou Retour
 * 5. Avatars en temps réel : réception et émission des mises à jour d'avatars pris
 * 6. Salle d'attente : quitter la session et réinitialiser l'état local
 * Cas limites couverts:
 * - suppression avec roomId inexistant (aucun effet).
 * - leaveGameSession sans session courante (aucune émission).
 * - démarrage de partie reçu pour un joueur absent (retour accueil).
 * - liste d'avatars vide (réinitialisation complète du signal).
 */

describe('GameSessionSocketService', () => {
    let service: GameSessionSocketService;
    let socketServiceMock: jasmine.SpyObj<SocketService>;
    let routerMock: jasmine.SpyObj<Router>;
    let dialogMock: jasmine.SpyObj<MatDialog>;

    const getSocketCallback = <T>(event: GameSessionEvents): ((data: T) => void) => {
        const callback = socketServiceMock.on.calls
            .all()
            .find(call => call.args[0] === event)?.args[1] as ((data: T) => void) | undefined;

        expect(callback).toBeDefined();
        return callback as (data: T) => void;
    };

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

            const callbackGameList = getSocketCallback<GameSession[]>(GameSessionEvents.GameSessionList);

            callbackGameList(mockGameSessions);

            expect(service.gameSessions()).toEqual(mockGameSessions);
        });
    });

    describe('Création d\'une partie', () => {
        it('devrait ajouter une nouvelle partie à la liste lors de GameSessionCreated', () => {
            service.gameSessions.set([mockGameSession]);

            service.connect();

            const callbackGameCreated = getSocketCallback<GameSession>(GameSessionEvents.GameSessionCreated);

            callbackGameCreated(mockGameSession2);

            const gameSessions = service.gameSessions();
            expect(gameSessions.length).toBe(2);
            expect(gameSessions[1]).toEqual(mockGameSession2);
        });
    });

    describe('Suppression d\'une partie', () => {
        it('devrait supprimer une partie de la liste lors de GameSessionDeleted', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const callbackGameDeleted = getSocketCallback<string>(GameSessionEvents.GameSessionDeleted);

            callbackGameDeleted('room1');

            const sessions = service.gameSessions();
            expect(sessions.length).toBe(1);
            expect(sessions[0].roomId).toBe('room2');
        });

        it('ne devrait pas supprimer une partie avec un id inexistant', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const callbackGameDeleted = getSocketCallback<string>(GameSessionEvents.GameSessionDeleted);

            callbackGameDeleted('unknown');

            expect(service.gameSessions().length).toBe(2);
        });
    });

    describe('Déconnexion', () => {
        it('devrait arrêter d\'écouter tous les événements lors de la déconnexion', () => {
            service.connect();
            service.disconnect();

            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionList);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionListUpdated);
            expect(socketServiceMock.off).toHaveBeenCalledWith(GameSessionEvents.GameSessionCreated);
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

            const callbackAvatarUpdated = getSocketCallback<number[]>(GameSessionEvents.AvatarTakenUpdated);

            callbackAvatarUpdated([1, AVATAR_ID_THREE, AVATAR_ID_FIVE]);

            expect(service.takenAvatars()).toEqual([1, AVATAR_ID_THREE, AVATAR_ID_FIVE]);
        });

        it('devrait vider takenAvatars quand la liste est vide', () => {
            service.takenAvatars.set([1, 2]);
            service.connect();

            const callbackAvatarUpdated = getSocketCallback<number[]>(GameSessionEvents.AvatarTakenUpdated);

            callbackAvatarUpdated([]);

            expect(service.takenAvatars()).toEqual([]);
        });
    });

    describe('Intégration complète', () => {
        it('devrait gérer plusieurs événements socket successifs', () => {
            service.connect();

            const callbackList = getSocketCallback<GameSession[]>(GameSessionEvents.GameSessionList);

            callbackList([mockGameSession]);
            expect(service.gameSessions().length).toBe(1);

            const callbackCreated = getSocketCallback<GameSession>(GameSessionEvents.GameSessionCreated);

            callbackCreated(mockGameSession2);
            expect(service.gameSessions().length).toBe(2);

            const callbackDeleted = getSocketCallback<string>(GameSessionEvents.GameSessionDeleted);

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
    });

    describe('Événement GameStarted', () => {
        it('devrait naviguer vers game-view pour un joueur présent dans la session', () => {
            socketServiceMock.getSocketId.and.returnValue('socket1');
            service.connect();

            const callbackGameStarted = getSocketCallback<{ roomId: string; mapData: unknown; gameSession: GameSession }>(
                GameSessionEvents.GameStarted,
            );

            callbackGameStarted({
                roomId: 'room1',
                mapData: { id: 'map-1' },
                gameSession: {
                    ...mockGameSession,
                    players: [mockPlayer],
                } as unknown as GameSession,
            });

            expect(service.currentSession()?.roomId).toBe('room1');
            expect(routerMock.navigate).toHaveBeenCalledWith(['/game-view'], { queryParams: { roomId: 'room1' } });
        });

        it('devrait retourner à l\'accueil si le joueur n\'est pas dans la session démarrée', () => {
            socketServiceMock.getSocketId.and.returnValue('socket999');
            service.connect();

            const callbackGameStarted = getSocketCallback<{ roomId: string; mapData: unknown; gameSession: GameSession }>(
                GameSessionEvents.GameStarted,
            );

            callbackGameStarted({
                roomId: 'room1',
                mapData: { id: 'map-1' },
                gameSession: {
                    ...mockGameSession,
                    players: [mockPlayer],
                } as unknown as GameSession,
            });

            expect(dialogMock.open).toHaveBeenCalled();
            expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('Erreur de jointure (GameSessionJoinError)', () => {
        it('devrait ouvrir un dialog d\'avertissement avec un message d\'erreur', () => {
            const mockDialogRef = { afterClosed: () => of(false) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            service.connect();

            const callbackJoinError = getSocketCallback<string>(GameSessionEvents.GameSessionJoinError);

            callbackJoinError('La partie est pleine');

            expect(dialogMock.open).toHaveBeenCalled();
            const dialogData = dialogMock.open.calls.mostRecent().args[1]?.data as JoinErrorDialogData;
            expect(dialogData.title).toBe('Erreur de jointure');
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

            const callbackJoinError = getSocketCallback<string>(GameSessionEvents.GameSessionJoinError);

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

            const callbackJoinError = getSocketCallback<string>(GameSessionEvents.GameSessionJoinError);

            callbackJoinError('La session de jeu a déjà commencé');

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
            service.updateTakenAvatars('ROOM1', AVATAR_ID_THREE);

            expect(socketServiceMock.emit).toHaveBeenCalledWith(
                GameSessionEvents.AvatarTakenUpdated,
                { roomId: 'ROOM1', newAvatarId: AVATAR_ID_THREE },
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

});
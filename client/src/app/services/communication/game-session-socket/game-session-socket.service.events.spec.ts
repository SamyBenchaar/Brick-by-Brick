import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { GameSession } from '@app/interfaces/game-session';
import { GameSessionEvents } from '@common/game.events';
import { of } from 'rxjs';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { mockGameSession, mockGameSession2 } from '@app/services/communication/game-session-socket/game-session-socket.service.spec.mocks';

const AVATAR_ID_THREE = 3;

describe('GameSessionSocketService (events)', () => {
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

    describe('Joueur exclu (PlayerKicked)', () => {
        it('devrait réinitialiser la session et naviguer vers l\'accueil quand un joueur est exclu', async () => {
            const mockDialogRef = { afterClosed: () => of(true) } as unknown as MatDialogRef<unknown>;
            dialogMock.open.and.returnValue(mockDialogRef);

            service.currentSession.set(mockGameSession);
            service.connect();

            const callbackKicked = getSocketCallback<{ message: string }>(GameSessionEvents.PlayerKicked);

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

            const callbackCancelled = getSocketCallback<{ message: string }>(GameSessionEvents.RoomCancelled);

            callbackCancelled({ message: 'La salle a été annulée' });

            expect(service.currentSession()).toBeNull();
            expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
        });
    });

    describe('Suppression de la session courante', () => {
        it('devrait réinitialiser currentSession et takenAvatars quand la session courante est supprimée', () => {
            service.currentSession.set(mockGameSession);
            service.takenAvatars.set([1, 2, AVATAR_ID_THREE]);

            service.connect();

            const callbackDeleted = getSocketCallback<string>(GameSessionEvents.GameSessionDeleted);

            callbackDeleted('room1');

            expect(service.currentSession()).toBeNull();
            expect(service.takenAvatars()).toEqual([]);
        });
    });

    describe('Mise à jour dynamique de la liste (GameSessionListUpdated)', () => {
        it('devrait mettre à jour la liste complète des sessions lors de GameSessionListUpdated', () => {
            service.gameSessions.set([mockGameSession, mockGameSession2]);

            service.connect();

            const callbackListUpdated = getSocketCallback<GameSession[]>(GameSessionEvents.GameSessionListUpdated);

            callbackListUpdated([mockGameSession2]);

            expect(service.gameSessions().length).toBe(1);
            expect(service.gameSessions()[0].roomId).toBe('room2');
        });
    });
});

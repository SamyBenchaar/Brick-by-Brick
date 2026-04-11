import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { WaitingRoomListComponent } from '@app/components/waiting-room-list/waiting-room-list.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';

const WAITING_ROOM_ACCESS_KEY = 'waitingRoomAccess';

@Component({
    selector: 'app-waiting-room-page',
    imports: [ChatComponent, CommonModule, WaitingRoomListComponent],
    templateUrl: './waiting-room-page.component.html',
    styleUrls: ['./waiting-room-page.component.scss'],
})
export class WaitingRoomPage implements OnInit, OnDestroy {
    private router = inject(Router);
    private activatedRoute = inject(ActivatedRoute);
    protected gameSessionSocketService = inject(GameSessionSocketService);

    username: string = 'Player';
    roomIdFromRoute: string = '';
    isWriting: boolean = true;

    get roomId(): string {
        if (this.roomIdFromRoute) {
            return this.roomIdFromRoute;
        }
        return this.gameSessionSocketService.currentSession()?.roomId || '';
    }

    get hostId(): string {
        return this.gameSessionSocketService.currentSession()?.players[0]?.socketId || '';
    }

    ngOnInit(): void {
        const hasWaitingRoomAccess = sessionStorage.getItem(WAITING_ROOM_ACCESS_KEY) === 'true';
        if (!hasWaitingRoomAccess) {
            this.router.navigate(['/home']);
            return;
        }
        sessionStorage.removeItem(WAITING_ROOM_ACCESS_KEY);

        const isRefresh = sessionStorage.getItem('waitingRoomRefresh');
        if (isRefresh === 'true') {
            sessionStorage.removeItem('waitingRoomRefresh');
            this.gameSessionSocketService.leaveGameSession();
            this.router.navigate(['/home']);
            return;
        }

        this.username = sessionStorage.getItem('playerUsername') || 'Player';

        const params = this.activatedRoute.snapshot.params;
        if (params.gameId) {
            this.roomIdFromRoute = params.gameId;
        }

        this.gameSessionSocketService.connect();

        sessionStorage.setItem('waitingRoomRefresh', 'true');
        window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
    ngOnDestroy(): void {
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        sessionStorage.removeItem('waitingRoomRefresh');
        this.gameSessionSocketService.leaveGameSession();
    }

    handleBeforeUnload = (): void => {
        sessionStorage.removeItem(WAITING_ROOM_ACCESS_KEY);
        this.gameSessionSocketService.leaveGameSession();
        location.replace('/home');
    };

    leave(): void {
        sessionStorage.removeItem(WAITING_ROOM_ACCESS_KEY);
        this.gameSessionSocketService.leaveGameSession();
        this.router.navigate(['/home']);
    }
}


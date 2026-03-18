import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { WaitingRoomListComponent } from '@app/components/waiting-room-list/waiting-room-list.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';

@Component({
    selector: 'app-waiting-room-page',
    imports: [ChatComponent, CommonModule, WaitingRoomListComponent],
    templateUrl: './waiting-room-page.component.html',
    styleUrls: ['./waiting-room-page.component.scss'],
})
export class WaitingRoomPage implements OnInit {
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
        this.username = sessionStorage.getItem('playerUsername') || 'Player';

        const params = this.activatedRoute.snapshot.params;
        if (params.gameId) {
            this.roomIdFromRoute = params.gameId;
        }

        this.gameSessionSocketService.connect();
    }

    leave(): void {
        this.gameSessionSocketService.leaveGameSession();
        this.router.navigate(['/home']);
    }
}

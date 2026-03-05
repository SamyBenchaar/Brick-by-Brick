import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';

@Component({
    selector: 'app-waiting-room-page',
    imports: [ChatComponent, CommonModule],
    templateUrl: './waiting-room-page.component.html',
    styleUrls: ['./waiting-room-page.component.scss'],
})
export class WaitingRoomPage implements OnInit, OnDestroy {
    private router = inject(Router);
    private activatedRoute = inject(ActivatedRoute);
    protected gameSessionSocketService = inject(GameSessionSocketService);

    username: string = 'Player';
    roomIdFromRoute: string = '';

    get roomId(): string {
        return this.roomIdFromRoute || this.gameSessionSocketService.currentSession()?.roomId || '';
    }

    get hostId(): string {
        return this.gameSessionSocketService.currentSession()?.getHostSocketId() || '';
    }

    ngOnInit(): void {
        // Get username from sessionStorage
        this.username = sessionStorage.getItem('playerUsername') || 'Player';

        // Get gameId from route params
        this.activatedRoute.params.subscribe(params => {
            if (params.gameId) {
                this.roomIdFromRoute = params.gameId;
            }
        });

        this.gameSessionSocketService.connect();
    }

    ngOnDestroy(): void {
        this.gameSessionSocketService.disconnect();
    }

    leave(): void {
        this.gameSessionSocketService.leaveGameSession();
        this.router.navigate(['/home']);
    }
}

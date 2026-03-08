import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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
export class WaitingRoomPage implements OnInit, OnDestroy {
    private router = inject(Router);
    private activatedRoute = inject(ActivatedRoute);
    protected gameSessionSocketService = inject(GameSessionSocketService);

    username: string = 'Player';
    roomIdFromRoute: string = '';

    get roomId(): string {
        // Toujours utiliser le roomId de la route en priorité
        if (this.roomIdFromRoute) {
            return this.roomIdFromRoute;
        }
        return this.gameSessionSocketService.currentSession()?.roomId || '';
    }

    get hostId(): string {
        return this.gameSessionSocketService.currentSession()?.players[0]?.socketId || '';
    }

    ngOnInit(): void {
        // Get username from sessionStorage
        this.username = sessionStorage.getItem('playerUsername') || 'Player';

        // Get roomId from route params SYNCHRONOUSLY (the route param is called 'gameId' but it contains the roomId)
        const params = this.activatedRoute.snapshot.params;
        if (params.gameId) {
            this.roomIdFromRoute = params.gameId;
        }

        this.gameSessionSocketService.connect();
    }

    ngOnDestroy(): void {
        // this.gameSessionSocketService.disconnect();
    }

    leave(): void {
        this.gameSessionSocketService.leaveGameSession();
        this.router.navigate(['/home']);
    }
}

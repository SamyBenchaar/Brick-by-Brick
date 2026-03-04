import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { ChatComponent } from '@app/components/chat/chat.component';

@Component({
    selector: 'app-waiting-room-page',
    imports: [ChatComponent],
    templateUrl: './waiting-room-page.component.html',
    styleUrls: ['./waiting-room-page.component.scss'],
})
export class WaitingRoomPage implements OnInit, OnDestroy {
    private router = inject(Router);
    private gameSessionSocketService = inject(GameSessionSocketService);
    
    ngOnInit(): void {
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

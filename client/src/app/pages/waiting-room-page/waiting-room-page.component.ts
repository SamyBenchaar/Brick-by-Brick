import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';

@Component({
    selector: 'app-waiting-room-page',
    imports: [],
    templateUrl: './waiting-room-page.component.html',
    styleUrls: ['./waiting-room-page.component.scss'],
})
export class WaitingRoomPage {
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
        this.router.navigate(["/home"]);
    }
}

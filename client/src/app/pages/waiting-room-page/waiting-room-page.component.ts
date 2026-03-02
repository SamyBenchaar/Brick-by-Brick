import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';

@Component({
    selector: 'app-waiting-room-page',
    imports: [RouterLink, ChatComponent],
    templateUrl: './waiting-room-page.component.html',
    styleUrls: ['./waiting-room-page.component.scss'],
})
export class WaitingRoomPage implements OnInit {
    username: string = 'Player'; // aller chercher le nom du joueur à partir de la session 
    gameId: string = ''; // aller chercher l'ID du jeu à partir de la session

    ngOnInit(): void {
        // aller chercher le nom du joueur et l'ID du jeu à partir de la sessionStorage
        this.username = sessionStorage.getItem('playerUsername') || 'Player';
        this.gameId = sessionStorage.getItem('gameId') || '';
    }
}

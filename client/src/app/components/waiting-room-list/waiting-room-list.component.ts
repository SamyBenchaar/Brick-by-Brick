import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AVATARS } from '@app/constants/character-constants';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';

@Component({
    selector: 'app-waiting-room-list',
    imports: [CommonModule],
    templateUrl: './waiting-room-list.component.html',
    styleUrls: ['./waiting-room-list.component.scss'],
})
export class WaitingRoomListComponent {
    gameSessionSocketService = inject(GameSessionSocketService);

    isCurrentUserHost(): boolean {
        return this.gameSessionSocketService.isCurrentUserHost();
    }

    canStartGame(): boolean {
        return this.gameSessionSocketService.canStartGame();
    }

    isPlayerHost(socketId: string): boolean {
        return this.gameSessionSocketService.isPlayerHost(socketId);
    }

    isSelf(socketId: string): boolean {
        return socketId === this.gameSessionSocketService.getSocketId();
    }

    getCharacterName(character: Character): string {
        return character?.name ?? 'Joueur';
    }

    getAvatarImage(character: Character): string {
        return AVATARS.find(a => a.id === character?.avatarId)?.image ?? './assets/images/lily.jpg';
    }

    onKick(socketId: string): void {
        this.gameSessionSocketService.kickPlayer(socketId);
    }

    startGame(): void {
        this.gameSessionSocketService.startGame();
    }
}

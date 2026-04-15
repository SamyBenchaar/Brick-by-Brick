import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AVATARS } from '@app/constants/character-constants';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { Character } from '@common/character';
import { Player } from '@common/player';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';

@Component({
    selector: 'app-waiting-room-list',
    imports: [CommonModule],
    templateUrl: './waiting-room-list.component.html',
    styleUrls: ['./waiting-room-list.component.scss'],
})
export class WaitingRoomListComponent {
    gameSessionSocketService = inject(GameSessionSocketService);
    readonly virtualPlayerProfile = VirtualPlayerProfile;
    isProfileDialogOpen = false;

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
        return AVATARS.find(avatarOption => avatarOption.id === character?.avatarId)?.image ?? './assets/images/lily.jpg';
    }

    onKick(socketId: string): void {
        this.gameSessionSocketService.kickPlayer(socketId);
    }

    openVirtualPlayerDialog(): void {
        if (this.isSessionFull()) {
            return;
        }
        this.isProfileDialogOpen = true;
    }

    closeVirtualPlayerDialog(): void {
        this.isProfileDialogOpen = false;
    }

    onAddVirtualPlayer(profile: VirtualPlayerProfile): void {
        if (this.isSessionFull()) {
            return;
        }
        this.gameSessionSocketService.addVirtualPlayer(profile);
        this.closeVirtualPlayerDialog();
    }

    isSessionFull(): boolean {
        const session = this.gameSessionSocketService.currentSession();
        if (!session) {
            return false;
        }
        return session.players.length >= session.maxPlayers;
    }

    isVirtualPlayer(player: Player): boolean {
        return player.virtualProfile !== undefined;
    }

    isAggressiveVirtualPlayer(player: Player): boolean {
        return player.virtualProfile === VirtualPlayerProfile.Aggressive;
    }

    isDefensiveVirtualPlayer(player: Player): boolean {
        return player.virtualProfile === VirtualPlayerProfile.Defensive;
    }

    getPlayerRole(player: Player): string {
        if (this.isPlayerHost(player.socketId)) {
            return 'Organisateur';
        }
        if (player.virtualProfile === VirtualPlayerProfile.Aggressive) {
            return 'JV agressif';
        }
        if (player.virtualProfile === VirtualPlayerProfile.Defensive) {
            return 'JV défensif';
        }
        return 'Joueur';
    }

    startGame(): void {
        this.gameSessionSocketService.startGame();
    }
}

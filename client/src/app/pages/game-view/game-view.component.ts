import { CommonModule } from '@angular/common';
import { Component, effect, HostListener, inject, Injector, OnDestroy, OnInit } from '@angular/core';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { AVATARS } from '@app/constants/character.constants';
import { getGameSizeConfig } from '@app/constants/game-config-constants';
import { Game } from '@app/interfaces/game';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Character } from '@common/character';
import { MapSize } from '@common/map';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game-view',
  imports: [CommonModule, GameGridComponent, ChatComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit, OnDestroy {
  gameSessionSocketService = inject(GameSessionSocketService);
  private injector = inject(Injector);
  private routeSubscription?: Subscription;

  gameData: Game | null = null;

  ngOnInit(): void {
    effect(() => {
      const map = this.gameSessionSocketService.mapCopy();
      this.gameData = map ? JSON.parse(JSON.stringify(map)) : null;
    }, { injector: this.injector });

    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    if (!this.isMyTurn()) {
      return;
    }

    const key = event.key.toLowerCase();
    let direction = '';

    if (key === 'w' || key === 'arrowup') {
      direction = 'arrowUp';
    } else if (key === 'a' || key === 'arrowleft') {
      direction = 'arrowLeft';
    } else if (key === 's' || key === 'arrowdown') {
      direction = 'arrowDown';
    } else if (key === 'd' || key === 'arrowright') {
      direction = 'arrowRight';
    }

    if (direction) {
      this.gameSessionSocketService.requestMove(direction);
    }
  }

  handleBeforeUnload = (): void => {
    this.gameSessionSocketService.abandonGame();
  };

  getMapSize(): MapSize {
    if (!this.gameData) {
      return MapSize.Small;
    }
    const config = getGameSizeConfig(this.gameData.mapConfig.size);
    return config.gridSize;
  }

  getPlayerCount(): number {
    return this.gameSessionSocketService.currentSession()?.players.length ?? 0;
  }

  get hostId(): string {
    return this.gameSessionSocketService.hostSocketId() ?? '';
  }

  get roomId(): string {
    return this.gameSessionSocketService.currentSession()?.roomId || '';
  }

  getCurrentPlayer(): Character | null {
    const socketId = this.gameSessionSocketService.getSocketId();
    const player = this.gameSessionSocketService.currentSession()?.players.find(p => p.socketId === socketId);
    return player?.character ?? null;
  }

  isMyTurn(): boolean {
    return this.gameSessionSocketService.isMyTurn();
  }

  getCurrentTurnPlayerName(): string {
    const currentPlayerId = this.gameSessionSocketService.currentPlayerTurn();
    const player = this.gameSessionSocketService.currentSession()?.players.find(p => p.character.id === currentPlayerId);
    return player?.character.name ?? '';
  }

  getTurnTimeRemaining(): number {
    return this.gameSessionSocketService.turnTimeRemaining();
  }

  isTurnStarting(): boolean {
    return this.gameSessionSocketService.turnStarting();
  }

  endTurn(): void {
    this.gameSessionSocketService.endTurn();
  }

  abandonGame(): void {
    if (confirm('Êtes-vous sûr de vouloir abandonner la partie?')) {
      this.gameSessionSocketService.abandonGame();
    }
  }

  getPlayers(): Character[] {
    return this.gameSessionSocketService.currentSession()?.players.map(p => p.character) ?? [];
  }

  getAvatarImage(avatarId: number): string {
    return AVATARS.find(a => a.id === avatarId)?.image ?? 'assets/images/lily.jpg';
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }
}

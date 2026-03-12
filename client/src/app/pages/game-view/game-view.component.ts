import { CommonModule } from '@angular/common';
import { Component, computed, effect, HostListener, inject, Injector, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { PlayerBoardComponent } from '@app/components/game-view-components/player-board/player-board/player-board.component';
import { PlayerSignComponent } from '@app/components/game-view-components/player-sign/player-sign/player-sign.component';
import { AVATARS } from '@app/constants/character.constants';
import { Game } from '@app/interfaces/game';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Character } from '@common/character';
import { getGameSizeConfig } from '@common/constants/game-config-constants';
import { MapSize } from '@common/map';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-game-view',
  imports: [CommonModule, GameGridComponent, ChatComponent, PlayerBoardComponent, PlayerSignComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit, OnDestroy {
  gameSessionSocketService = inject(GameSessionSocketService);
  private router = inject(Router);
  private injector = inject(Injector);
  private routeSubscription?: Subscription;

  gameData: Game | null = null;
  isChatCollapsed = false;

  playerList = computed(() => this.gameSessionSocketService.currentSession()?.players ?? []);
  leftPlayerList = computed(() => this.gameSessionSocketService.currentSession()?.leftPlayers ?? []);
  hostPlayer = computed(() => this.gameSessionSocketService.currentSession()?.host);
  roomId = computed(() => this.gameSessionSocketService.currentSession()?.roomId || '');
  playerCount = computed(() => this.gameSessionSocketService.currentSession()?.players?.length ?? 0);
  currentPlayer = computed(() => {
    const socketId = this.gameSessionSocketService.getSocketId();
    return this.gameSessionSocketService.currentSession()?.players.find(p => p.socketId === socketId) ?? null;
  });
  isDebugModeActivated = computed(() => this.gameSessionSocketService.isDebugModeActivated());

  ngOnInit(): void {
    if (!this.gameSessionSocketService.currentSession() || !this.gameSessionSocketService.mapCopy()) {
      this.router.navigate(['/']);
      return;
    }

    effect(() => {
      const map = this.gameSessionSocketService.mapCopy();
      this.gameData = map ? JSON.parse(JSON.stringify(map)) : null;
    }, { injector: this.injector });

    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();

    if (key === 'm' && this.gameSessionSocketService.isCurrentUserHost()) {
      this.gameSessionSocketService.activateDebug();
      return;
    }
    if (!this.isMyTurn()) {
      return;
    }

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

  get hostId(): string {
    return this.gameSessionSocketService.hostSocketId() ?? '';
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
  leaveGameSession(): void {
    this.gameSessionSocketService.leaveGameSession();
    this.router.navigate(['/home']);
  }
}

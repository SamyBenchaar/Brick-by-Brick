import { CommonModule } from '@angular/common';
import { Component, effect, inject, Injector, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { PlayerBoardComponent } from '@app/components/game-view-components/player-board/player-board/player-board.component';
import { PlayerSignComponent } from '@app/components/game-view-components/player-sign/player-sign/player-sign.component';
import { getGameSizeConfig } from '@common/constants/game-config-constants';
import { Game } from '@app/interfaces/game';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { Player } from '@common/player';
import { MapSize } from '@common/map';

@Component({
  selector: 'app-game-view',
  imports: [CommonModule, GameGridComponent, ChatComponent, PlayerBoardComponent, PlayerSignComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit {
  gameSessionSocketService = inject(GameSessionSocketService);
  private router = inject(Router);
  private injector = inject(Injector);

  gameData: Game | null = null;
  isChatCollapsed = false;

  ngOnInit(): void {
    effect(() => {
      const map = this.gameSessionSocketService.mapCopy();
      this.gameData = map ? JSON.parse(JSON.stringify(map)) : null;
    }, { injector: this.injector });
  }

  get playerList(): Player[] {
    return this.gameSessionSocketService.currentSession()?.players ?? [];
  }

  get leftPlayerList(): Player[] {
    return this.gameSessionSocketService.currentSession()?.leftPlayers ?? [];
  }

  getMapSize(): MapSize {
    if (!this.gameData) {
      return MapSize.Small;
    }
    const config = getGameSizeConfig(this.gameData.mapConfig.size);
    return config.gridSize;
  }

  get playerCount(): number {
    return this.gameSessionSocketService.currentSession()?.players?.length ?? 0;
  }

  get hostPlayer(): Player | undefined {
    return this.gameSessionSocketService.currentSession()?.host;
  }

  get hostId(): string {
    return this.gameSessionSocketService.hostSocketId() ?? '';
  }

  get roomId(): string {
    return this.gameSessionSocketService.currentSession()?.roomId || '';
  }
  get currentPlayer(): Player | null {
    const socketId = this.gameSessionSocketService.getSocketId();
    return this.gameSessionSocketService.currentSession()?.players.find(p => p.socketId === socketId) ?? null;
  }

  leaveGameSession(): void {
    this.gameSessionSocketService.leaveGameSession();
    this.router.navigate(['/home']);
  }
}

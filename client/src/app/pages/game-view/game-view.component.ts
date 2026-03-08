import { CommonModule } from '@angular/common';
import { Component, effect, Injector, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { MapSize } from '@common/map';
import { getGameSizeConfig } from '@app/constants/game-config-constants';
import { Subscription } from 'rxjs';
import { Game } from '@app/interfaces/game';
import { Character } from '@common/character';
import { ChatComponent } from '@app/components/chat/chat.component';

@Component({
  selector: 'app-game-view',
  imports: [RouterLink, CommonModule, GameGridComponent, ChatComponent],
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
  }

  getMapSize(): MapSize {
    if (!this.gameData) {
      return MapSize.Small;
    }
    const config = getGameSizeConfig(this.gameData.mapConfig.size);
    return config.gridSize;
  }

  getPlayerCount():number{
    return this.gameSessionSocketService.currentSession()?.players.length ?? 0;
  }

  get hostId(): string {
    return this.gameSessionSocketService.hostSocketId() ?? '';
  }

  get roomId():string {
    return this.gameSessionSocketService.currentSession()?.roomId || '';
  }
  getCurrentPlayer(): Character | null {
    const socketId = this.gameSessionSocketService.getSocketId();
    const player = this.gameSessionSocketService.currentSession()?.players.find(p => p.socketId === socketId);
    return player?.character ?? null;
  }
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }
}

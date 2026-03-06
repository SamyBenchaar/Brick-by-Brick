import { CommonModule } from '@angular/common';
import { Component, effect, Injector, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { MapSize } from '@common/map';
import { getGameSizeConfig } from '@app/constants/game-config-constants';
import { Subscription } from 'rxjs';
import { Game } from '@app/interfaces/game';

@Component({
  selector: 'app-game-view',
  imports: [RouterLink, CommonModule, GameGridComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private gameSessionSocketService = inject(GameSessionSocketService);
  private injector = inject(Injector);
  private routeSubscription?: Subscription;

  roomId: string = '';
  gameData: Game | null = null;

  ngOnInit(): void {
    
    effect(() => {
      const map = this.gameSessionSocketService.mapCopy();
      this.gameData = map;
    }, { injector: this.injector });

    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      this.roomId = params.get('roomId') || '';

      if (this.roomId) {
        this.gameSessionSocketService.connect();
        this.gameSessionSocketService.requestMapCopy(this.roomId);
      }
    });
  }

  getMapSize(): MapSize {
    if (!this.gameData) {
      return MapSize.Small;
    }
    const config = getGameSizeConfig(this.gameData.mapConfig.size);
    return config.gridSize;
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }
}

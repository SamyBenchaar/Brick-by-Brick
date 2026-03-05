import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';

@Component({
  selector: 'app-game-view',
  imports: [RouterLink, BaseSignComponent, CommonModule, GameGridComponent],
  templateUrl: './game-view.component.html',
  styleUrl: './game-view.component.scss',
})
export class GameViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private gameSessionSocketService = inject(GameSessionSocketService);

  roomId: string = '';
  mapCopy = this.gameSessionSocketService.mapCopy;

  ngOnInit(): void {
    this.roomId = this.route.snapshot.queryParamMap.get('roomId') || '';

    if (this.roomId) {
      this.gameSessionSocketService.connect();
      this.gameSessionSocketService.requestMapCopy(this.roomId);
    }

  }

  ngOnDestroy(): void {
    this.gameSessionSocketService.disconnect();
  }


}

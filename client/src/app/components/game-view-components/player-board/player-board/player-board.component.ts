import { Component, Input } from '@angular/core';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { Player } from '@common/player';

@Component({
  selector: 'app-player-board',
  imports: [BaseSignComponent],
  templateUrl: './player-board.component.html',
  styleUrl: './player-board.component.scss',
})
export class PlayerBoardComponent {
  @Input() players: Player[] = [];
  @Input() leftPlayers: Player[] = [];
  @Input() host: Player | undefined = undefined;
  name: string = 'Players board';
}

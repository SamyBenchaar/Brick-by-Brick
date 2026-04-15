import { Component, Input } from '@angular/core';
import { GameModeValue } from '@common/constants/game-config-constants';
import { SECONDS_TO_MINUTES_CONVERSION } from '@common/constants/game-statistics-constants';

@Component({
  selector: 'app-global-game-statistics',
  imports: [],
  templateUrl: './global-game-statistics.component.html',
  styleUrl: './global-game-statistics.component.scss',
})
export class GlobalGameStatisticsComponent {

  gameModeValue = GameModeValue;

  @Input() durationSeconds: number = 0;
  @Input() totalTurns: number = 0;
  @Input() gameMode: string = 'classic';
  @Input() tilesVisitedPercent: number = 0;
  @Input() sanctuariesUsedPercent: number | null = null;
  @Input() doorsUsedPercent: number | null = null;
  @Input() flagHoldersCount: number | null = null;


  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / SECONDS_TO_MINUTES_CONVERSION).toString().padStart(2, '0');
    const s = (seconds % SECONDS_TO_MINUTES_CONVERSION).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

}

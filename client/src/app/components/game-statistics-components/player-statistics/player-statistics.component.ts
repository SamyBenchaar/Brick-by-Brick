import { Component, Input } from '@angular/core';
import {Player} from '@common/player';
import {PERCENTAGE_MULTIPLIER, LARGE_TABLE_THRESHOLD, MEDIUM_TABLE_THRESHOLD} from '@app/constants/statistics-constants';
import { WinnerSummary, WinningTeam } from '@app/interfaces/game-play';

type SortColumn = 'combats' | 'victories' | 'defeats' | 'lifeLost' | 'damageDealt' | 'tilesVisited';
type SortDirection = 'asc' | 'desc';
@Component({
  selector: 'app-player-statistics',
  imports: [],
  templateUrl: './player-statistics.component.html',
  styleUrl: './player-statistics.component.scss',
})
export class PlayerStatisticsComponent {
  @Input() players: Player[]=[];
  @Input() walkableTiles: number=0;
  @Input() gameMode: string='classic';
  @Input() winner: WinnerSummary | null=null;
  @Input() winningTeam: WinningTeam | undefined=undefined;

  sortColumn: SortColumn | null =null;
  sortDirection: SortDirection = 'asc';

  get sortedPlayers(): Player[] {
        if (!this.sortColumn) return this.players;
    return [...this.players].sort((a, b) => {
      const aVal = this.getSortValue(a);
      const bVal = this.getSortValue(b);
      return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }

  sort(column: SortColumn, direction: SortDirection): void {
    this.sortColumn = column;
    this.sortDirection = direction;
  }

  private getSortValue(player: Player): number {
    const c = player.character;
    switch (this.sortColumn) {
      case 'combats': return (c.victories ?? 0) + (c.defeats ?? 0);
      case 'victories': return c.victories ?? 0;
      case 'defeats': return c.defeats ?? 0;
      case 'lifeLost': return c.totalDamageReceived ?? 0;
      case 'damageDealt': return c.totalDamageDealt ?? 0;
      case 'tilesVisited': return this.getTilesPercentage(c.tilesVisited ?? 0);
      default: return 0;
    }
  }
  getTilesPercentage(tilesVisited: number):number {
    if (this.walkableTiles === 0) return 0;
    return Math.round((tilesVisited/this.walkableTiles)*PERCENTAGE_MULTIPLIER);
  }

  get tableSizeClass(): string {
    if (this.players.length <= LARGE_TABLE_THRESHOLD) return 'size-large';
    if (this.players.length <= MEDIUM_TABLE_THRESHOLD) return 'size-medium';
    return 'size-small';
}
}

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Player } from '@common/player';
import { PlayerStatisticsComponent } from '@app/components/game-statistics-components/player-statistics/player-statistics.component';

@Component({
  selector: 'app-game-statistics',
  imports: [PlayerStatisticsComponent],
  templateUrl: './game-statistics.component.html',
  styleUrl: './game-statistics.component.scss',
})
export class GameStatisticsComponent implements OnInit {
  private router = inject(Router);
  winner: { id: string; name: string; avatarId: number } | null = null;
  winningTeam: 'team1' | 'team2' | undefined;
  gameMode: string = 'classic';
  players: Player[] = [];
  walkableTiles: number = 0;

  ngOnInit(): void {
    const state = history.state;
    this.winner = state.winner ?? null;
    this.winningTeam = state.winningTeam ?? undefined;
    this.gameMode = state.gameMode ?? 'classic';
    this.players = state.players ?? [];
    this.walkableTiles = state.walkableTiles ?? 0;
  }

  navigateHome(): void {
    this.router.navigate(['/']);
  }
}

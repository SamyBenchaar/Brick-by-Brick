import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Player } from '@common/player';
import { PlayerStatisticsComponent } from '@app/components/game-statistics-components/player-statistics/player-statistics.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';

@Component({
  selector: 'app-game-statistics',
  imports: [PlayerStatisticsComponent, ChatComponent],
  templateUrl: './game-statistics.component.html',
  styleUrl: './game-statistics.component.scss',
})
export class GameStatisticsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  winner: { id: string; name: string; avatarId: number } | null = null;
  winningTeam: 'team1' | 'team2' | undefined;
  gameMode: string = 'classic';
  players: Player[] = [];
  walkableTiles: number = 0;
  gameId: string = '';
  username: string = '';
  hostPlayerId: string = '';
  private gameSessionSocketService = inject(GameSessionSocketService);


  ngOnInit(): void {
    const state = history.state ?? {};
    this.winner = state.winner ?? null;
    this.winningTeam = state.winningTeam ?? undefined;
    this.gameMode = state.gameMode ?? 'classic';
    this.players = state.players ?? [];
    this.walkableTiles = state.walkableTiles ?? 0;
    this.gameId = state.gameId ?? '';
    this.username = state.username ?? '';
    this.hostPlayerId = state.hostPlayerId ?? '';
    if (this.gameId) {
      this.gameSessionSocketService.joinStatsPage(this.gameId);
    }
  }

  ngOnDestroy(): void {
    if (this.gameId) {
      this.gameSessionSocketService.leaveStatsPage(this.gameId);
    }
  }

  navigateHome(): void {
    this.router.navigate(['/']);
  }
}

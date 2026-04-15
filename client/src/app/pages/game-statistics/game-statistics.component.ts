import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Player } from '@common/player';
import { PlayerStatisticsComponent } from '@app/components/game-statistics-components/player-statistics/player-statistics.component';
import { ChatComponent } from '@app/components/chat/chat.component';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { GlobalGameStatisticsComponent } from '@app/components/game-statistics-components/global-game-statistics/global-game-statistics.component';

@Component({
  selector: 'app-game-statistics',
  imports: [PlayerStatisticsComponent, ChatComponent, GlobalGameStatisticsComponent],
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


  durationSeconds: number = 0;
  totalTurns: number = 0;
  sanctuariesUsedPercent: number | null = null;
  tilesVisitedPercent: number = 0;
  doorsUsedPercent: number | null = null;
  flagHoldersCount: number | null = null;
  
  ngOnInit(): void {
    this.loadStateFromHistory();
    if (this.gameId) {
      this.gameSessionSocketService.joinStatsPage(this.gameId);
    }
  }

  private loadStateFromHistory(): void {
    const state = history.state ?? {};
    this.loadPlayerState(state);
    this.loadGlobalStats(state);
  }

  private loadPlayerState(state: Record<string, unknown>): void {
    this.winner = (state.winner as { id: string; name: string; avatarId: number }) ?? null;
    this.winningTeam = (state.winningTeam as 'team1' | 'team2') ?? undefined;
    this.gameMode = (state.gameMode as string) ?? 'classic';
    this.players = (state.players as Player[]) ?? [];
    this.walkableTiles = (state.walkableTiles as number) ?? 0;
    this.gameId = (state.gameId as string) ?? '';
    this.username = (state.username as string) ?? '';
    this.hostPlayerId = (state.hostPlayerId as string) ?? '';
  }

  private loadGlobalStats(state: Record<string, unknown>): void {
    this.durationSeconds = (state.durationSeconds as number) ?? 0;
    this.totalTurns = (state.totalTurns as number) ?? 0;
    this.sanctuariesUsedPercent = (state.sanctuariesUsedPercent as number) ?? null;
    this.tilesVisitedPercent = (state.tilesVisitedPercent as number) ?? 0;
    this.doorsUsedPercent = (state.doorsUsedPercent as number) ?? null;
    this.flagHoldersCount = (state.flagHoldersCount as number) ?? null;
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

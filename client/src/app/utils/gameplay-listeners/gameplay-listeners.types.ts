import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Tile } from '@app/interfaces/game';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameEndedPayload } from '@app/services/communication/game-session-socket/game-play-types';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { Player } from '@common/player';
import { Position } from '@common/position';

export interface GameplayListenersContext {
    gamePlaySocketService: GamePlaySocketService;
    gameSessionSocketService: GameSessionSocketService;
    socketService: SocketService;
    router: Router;
    dialog: MatDialog;
    flagTransferService: FlagTransferSocketService;
    combatSocketService: CombatSocketService;
}

export interface GameStatisticsNavigationState {
    players: Player[];
    winner: GameEndedPayload['winner'];
    winningTeam: GameEndedPayload['winningTeam'];
    gameMode: GameEndedPayload['gameMode'];
    walkableTiles?: number;
    gameId?: string;
    username: string;
    hostPlayerId: string;
    durationSeconds: number;
    totalTurns: number;
    sanctuariesUsedPercent: number | null;
    tilesVisitedPercent: number;
    doorsUsedPercent: number | null;
    flagHoldersCount: number | null;
}

export interface HomeNavigationDependencies {
    gamePlaySocketService: GamePlaySocketService;
    gameSessionSocketService: GameSessionSocketService;
    router: Router;
    dialog: MatDialog;
}

export interface PlayerAbandonedPayload {
    playerId: string;
    mapCopyTiles: Tile[][];
    flagPosition?: Position | null;
    flagHolderId?: string | null;
}

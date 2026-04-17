import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';

export interface GameEndListenersDependencies {
    socketService: SocketService;
    gamePlaySocketService: GamePlaySocketService;
    gameSessionSocketService: GameSessionSocketService;
    router: Router;
    dialog: MatDialog;
}

export interface CombatResultListenerDependencies {
    gamePlaySocketService: GamePlaySocketService;
    gameSessionSocketService: GameSessionSocketService;
    combatSocketService: CombatSocketService;
}
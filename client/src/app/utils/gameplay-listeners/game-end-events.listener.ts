import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { DialogType } from '@app/constants/dialog-type.enum';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameEndedPayload } from '@app/interfaces/game-play';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { CTF_VICTORY_ANNOUNCE_DELAY, GameModeValue } from '@common/constants/game-config-constants';
import { GameSessionEvents } from '@common/game.events';
import { buildGameEndedMessage, buildStatisticsNavigationState } from './gameplay-listeners.shared';
import { HomeNavigationDependencies } from '@app/interfaces/gameplay-listeners';

export function registerGameEndEventListeners(
    socketService: SocketService,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    router: Router,
    dialog: MatDialog,
): void {
    socketService.on<GameEndedPayload>(GameSessionEvents.GameEnded, (data) => {
        if (gameSessionSocketService.hasAbandoned()) {
            gameSessionSocketService.hasAbandoned.set(false);
            gameSessionSocketService.currentSession.set(null);
            return;
        }

        gamePlaySocketService.gameEnded.set(true);

        const { title, message } = buildGameEndedMessage(data, gamePlaySocketService.getSocketId());
        const delay = getEndGameDelay(data, gameSessionSocketService);

        setTimeout(() => {
            if (data.reason === 'victory') {
                navigateToStatisticsPage(data, gamePlaySocketService, gameSessionSocketService, router);
                return;
            }

            navigateToHomeWithDialog(title, message, {
                gamePlaySocketService,
                gameSessionSocketService,
                router,
                dialog,
            });
        }, delay);
    });
}

function getEndGameDelay(
    data: GameEndedPayload,
    gameSessionSocketService: GameSessionSocketService,
): number {
    const isCtfVictory = data.gameMode === GameModeValue.Ctf && data.reason === 'victory';
    return isCtfVictory ? CTF_VICTORY_ANNOUNCE_DELAY : gameSessionSocketService.endGameDelay;
}

function navigateToStatisticsPage(
    data: GameEndedPayload,
    gamePlaySocketService: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    router: Router,
): void {
    const session = gamePlaySocketService.currentSession();
    const navigationState = buildStatisticsNavigationState(data, session, gamePlaySocketService);

    gamePlaySocketService.gameEnded.set(false);
    gameSessionSocketService.currentSession.set(null);

    router.navigate(['/game-statistics'], {
        state: navigationState,
    });
}

function navigateToHomeWithDialog(
    title: string,
    message: string,
    dependencies: HomeNavigationDependencies,
): void {
    const {
        gamePlaySocketService,
        gameSessionSocketService,
        router,
        dialog,
    } = dependencies;

    router.navigate(['/']).then(() => {
        dialog.open(AppDialogComponent, {
            data: {
                title,
                message,
                type: DialogType.INFO,
            },
            disableClose: true,
        });

        gamePlaySocketService.gameEnded.set(false);
        gameSessionSocketService.currentSession.set(null);
    });
}

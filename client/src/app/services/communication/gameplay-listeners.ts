import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Position } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { SocketService } from './socket.service';
import type { GameSessionSocketService } from './game-session-socket.service';

export function setupGameplayEventListeners(
    service: GameSessionSocketService,
    socketService: SocketService,
    router: Router,
    dialog: MatDialog,
): void {
    socketService.on<{ playerId: string; playerName: string; delay: number }>(
        GameSessionEvents.TurnStarting,
        (data) => {
            service.turnStarting.set(true);
            service.currentPlayerTurn.set(data.playerId);
        },
    );

    socketService.on<{ playerId: string; playerName: string; turnTime: number }>(
        GameSessionEvents.TurnStarted,
        (data) => {
            service.turnStarting.set(false);
            service.currentPlayerTurn.set(data.playerId);
            service.turnTimeRemaining.set(data.turnTime);
        },
    );

    socketService.on<{ timeRemaining: number }>(GameSessionEvents.TurnTimeUpdate, (data) => {
        service.turnTimeRemaining.set(data.timeRemaining);
    });

    socketService.on<{ playerId: string }>(GameSessionEvents.TurnEnded, () => {
        service.currentPlayerTurn.set(null);
        service.reachableTiles.set([]);
    });

    socketService.on<{ playerId: string; position: Position; remainingMovement: number; remainingActions: number }>(
        GameSessionEvents.MoveExecuted,
        (data) => {
            const session = service.currentSession();
            if (session) {
                const player = session.players.find(p => p.character.id === data.playerId);
                if (player) {
                    player.character.position = data.position;
                    player.character.remainingMovement = data.remainingMovement;
                    player.character.remainingActions = data.remainingActions;
                    service.currentSession.set({ ...session });
                }
            }
        },
    );

    socketService.on<{ playerId: string; tiles: Position[] }>(GameSessionEvents.ReachableTiles, (data) => {
        service.reachableTiles.set(data.tiles);
    });

    socketService.on<{
        winner: string;
        loser: string;
        attackerVictories: number;
        defenderNewPosition: Position;
        remainingActions: number;
    }>(GameSessionEvents.CombatResult, (data) => {
        const session = service.currentSession();
        if (session) {
            const attacker = session.players.find(p => p.character.id === data.winner);
            const defender = session.players.find(p => p.character.id === data.loser);
            if (attacker) {
                attacker.character.victories = data.attackerVictories;
                attacker.character.remainingActions = data.remainingActions;
            }
            if (defender) {
                defender.character.position = data.defenderNewPosition;
            }
            service.currentSession.set({ ...session });
        }
    });

    socketService.on<{ playerId: string }>(GameSessionEvents.PlayerAbandoned, (data) => {
        const session = service.currentSession();
        if (session) {
            session.players = session.players.filter(p => p.character.id !== data.playerId);
            if (session.playerOrder) {
                session.playerOrder = session.playerOrder.filter(id => id !== data.playerId);
            }
            service.currentSession.set({ ...session });
        }
    });

    socketService.on<{ winner: { id: string; name: string; avatarId: number } | null; reason: string }>(
        GameSessionEvents.GameEnded,
        (data) => {
            if (service.hasAbandoned()) {
                service.hasAbandoned.set(false);
                service.currentSession.set(null);
                return;
            }

            service.gameEnded.set(true);
            let message = '';
            let title = 'Partie terminée';

            if (data.reason === 'victory' && data.winner) {
                const mySocketId = service.getSocketId();
                if (data.winner.id === mySocketId) {
                    title = 'Victoire!';
                    message = 'Félicitations! Vous avez gagné la partie avec 3 victoires!';
                } else {
                    title = 'Partie terminée';
                    message = `${data.winner.name} a gagné la partie avec 3 victoires!`;
                }
            } else if (data.reason === 'noPlayers') {
                message = 'La partie est terminée car tous les autres joueurs ont abandonné.';
            } else {
                message = 'La partie est terminée.';
            }

            setTimeout(() => {
                router.navigate(['/']).then(() => {
                    dialog.open(AppDialogComponent, {
                        data: { title, message, type: data.reason === 'victory' ? 'info' : 'info' },
                        disableClose: true,
                    });
                    service.gameEnded.set(false);
                    service.currentSession.set(null);
                });
            }, service.endGameDelay);
        },
    );
}

import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Tile } from '@app/interfaces/game';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';

export function setupGameplayEventListeners(
    service: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    socketService: SocketService,
    router: Router,
    dialog: MatDialog,
): void {
    socketService.on<{ playerId: string; playerName: string; delay: number }>(
        GameSessionEvents.TurnStarting,
        (data) => {
            service.turnStarting.set(true);
            service.currentPlayerTurn.set(data.playerId);
            service.reachableTiles.set([]);
        },
    );

    socketService.on<{ playerId: string; playerName: string; turnTime: number; remainingMovement?: number; remainingActions?: number }>(
        GameSessionEvents.TurnStarted,
        (data) => {
            service.turnStarting.set(false);
            service.currentPlayerTurn.set(data.playerId);
            service.turnTimeRemaining.set(data.turnTime);

            const session = service.currentSession();
            if (session) {
                const player = session.players.find(p => p.character.id === data.playerId);
                if (player) {
                    if (data.remainingMovement !== undefined) {
                        player.character.remainingMovement = data.remainingMovement;
                    }
                    if (data.remainingActions !== undefined) {
                        player.character.remainingActions = data.remainingActions;
                    }
                    gameSessionSocketService.currentSession.set({ ...session });
                }
            }
        },
    );

    socketService.on<{ timeRemaining: number }>(GameSessionEvents.TurnTimeUpdate, (data) => {
        service.turnTimeRemaining.set(data.timeRemaining);
    });

    socketService.on<{ timeRemaining: number }>(GameSessionEvents.InterTurnTimeUpdate, (data) => {
        service.interTurnTimeRemaining.set(data.timeRemaining);
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
                    gameSessionSocketService.currentSession.set({ ...session });
                }
            }
        },
    );

    socketService.on<{ playerId: string; tiles: Position[] }>(
        GameSessionEvents.ReachableTiles,
        (data) => {
            const session = service.currentSession();
            const mySocketId = service.getSocketId();

            if (!session || !mySocketId) {
                service.reachableTiles.set([]);
                return;
            }

            const myPlayer = session.players.find((p) => p.socketId === mySocketId);
            if (!myPlayer) {
                service.reachableTiles.set([]);
                return;
            }

            const isMyTiles = myPlayer.character.id === data.playerId;
            const isMyTurn = service.currentPlayerTurn() === data.playerId;

            if (!isMyTiles || !isMyTurn) {
                service.reachableTiles.set([]);
                return;
            }

            service.reachableTiles.set(data.tiles);
        },
    );

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
            gameSessionSocketService.currentSession.set({ ...session });
        }
    });

    socketService.on<{ playerId: string; mapCopyTiles: Tile[][] }>(GameSessionEvents.PlayerAbandoned, (data) => {
        const session = service.currentSession();
        if (session) {
            const leftPlayer = session.players.find(p => p.character.id === data.playerId);
            if (leftPlayer) {
                session.leftPlayers = [...(session.leftPlayers ?? []), leftPlayer];
            }
            session.players = session.players.filter(p => p.character.id !== data.playerId);
            if (session.playerOrder) {
                session.playerOrder = session.playerOrder.filter(id => id !== data.playerId);
            }

            if (data.mapCopyTiles) {
                const currentMap = service.mapCopy();
                if (currentMap) {
                    service.mapCopy.set({
                        ...currentMap, mapConfig: { ...currentMap.mapConfig, tiles: data.mapCopyTiles },
                    });
                }
            }
            gameSessionSocketService.currentSession.set({ ...session });
        }
    });

    socketService.on<{ winner: { id: string; name: string; avatarId: number } | null; reason: string }>(
        GameSessionEvents.GameEnded,
        (data) => {
            if (gameSessionSocketService.hasAbandoned()) {
                gameSessionSocketService.hasAbandoned.set(false);
                gameSessionSocketService.currentSession.set(null);
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
                    gameSessionSocketService.currentSession.set(null);
                });
            }, gameSessionSocketService.endGameDelay);
        },
    );
}

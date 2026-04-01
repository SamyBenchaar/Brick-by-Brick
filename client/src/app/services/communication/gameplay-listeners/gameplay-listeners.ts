import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Tile } from '@app/interfaces/game';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { CombatResultPayload, CombatState } from '@common/combat';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';

export function setupGameplayEventListeners(
    service: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    socketService: SocketService,
    router: Router,
    dialog: MatDialog,
): void {
    const syncCombatSession = (combat: CombatState) => {
        const session = service.currentSession();
        if (!session) return;

        const attacker = session.players.find((player) => player.character.id === combat.attacker.id)?.character;
        const defender = session.players.find((player) => player.character.id === combat.defender.id)?.character;

        if (attacker) attacker.life = combat.attacker.life;
        if (defender) defender.life = combat.defender.life;

        gameSessionSocketService.currentSession.set({ ...session });
    };

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

    socketService.on<CombatState>(GameSessionEvents.CombatStarted, (combat) => {
        service.combatState.set(combat);
        syncCombatSession(combat);
    });

    socketService.on<CombatState>(GameSessionEvents.CombatUpdated, (combat) => {
        service.combatState.set(combat);
        syncCombatSession(combat);
    });

    socketService.on<CombatResultPayload>(GameSessionEvents.CombatResult, (data) => {
        const session = service.currentSession();

        if (session) {
            const attacker = session.players.find((player) => player.character.id === data.attackerId);
            const defender = session.players.find((player) => player.character.id === data.defenderId);

            if (attacker) {
                attacker.character.victories = data.attackerVictories;
                attacker.character.life = data.attackerLife;
                attacker.character.position = data.attackerPosition;
                attacker.character.remainingActions = data.remainingActions;
            }

            if (defender) {
                defender.character.victories = data.defenderVictories;
                defender.character.life = data.defenderLife;
                defender.character.position = data.defenderPosition;
            }

            gameSessionSocketService.currentSession.set({ ...session });
        }

        const myId = service.getCurrentPlayerCharacter()?.id;
        const wasParticipant = !!myId && service.combatParticipantIds().includes(myId);

        if (wasParticipant) {
            const message = !data.winnerId ? 'Égalité' : data.winnerId === myId ? 'Victoire' : 'Défaite';
            service.combatNotification.set(message);

            window.setTimeout(() => {
                if (service.combatNotification() === message) service.dismissCombatNotification();
            }, 3000);
        }

        service.combatState.set(null);
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

    socketService.on<{ isDebugModeActivated: boolean }>(GameSessionEvents.ToggleDebugMode, (data) => {
        service.isDebugModeActivated.set(data.isDebugModeActivated);
    });
}

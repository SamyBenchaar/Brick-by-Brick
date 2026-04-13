import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { Tile } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { FlagTransferSocketService } from '@app/services/communication/game-session-socket/flag-transfer-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { handleCombatResult, handleTurnEnded} from '@app/services/communication/gameplay-listeners/gameplay-listeners-helper.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { CTF_VICTORY_ANNOUNCE_DELAY } from '@common/constants/game-config-constants';
import { ORIGIN_CANDIDATES, SANCTUARY_COOLDOWN_TURNS, SANCTUARY_TILE_OFFSETS } from '@common/constants/santuary-constants';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';
import { Player } from '@common/player';
import { setupCombatListeners } from './combat-listener';
import {CombatResultPayload} from '@common/combat';

interface GameplayListenersContext {
    gamePlaySocketService: GamePlaySocketService;
    gameSessionSocketService: GameSessionSocketService;
    socketService: SocketService;
    router: Router;
    dialog: MatDialog;
    flagTransferService: FlagTransferSocketService;
    combatSocketService: CombatSocketService;
}

function findSanctuaryOrigin(position: Position, tiles: Tile[][]): Position | undefined {
    return ORIGIN_CANDIDATES.map(({ dx, dy }) => ({ x: position.x + dx, y: position.y + dy }))
        .find(candidate =>
            SANCTUARY_TILE_OFFSETS.every(({ dx, dy }) => {
                const t = tiles[candidate.y + dy]?.[candidate.x + dx];
                return t?.object?.type === ObjectType.HealingSanctuary || t?.object?.type === ObjectType.CombatSanctuary;
            }),
        );
}

export function setupGameplayEventListeners(context: GameplayListenersContext): void {
    const {
        gamePlaySocketService: service,
        gameSessionSocketService,
        socketService,
        router,
        dialog,
        flagTransferService,
        combatSocketService,
    } = context;

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
        handleTurnEnded(service, dialog, flagTransferService);
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

    setupCombatListeners(socketService, service, gameSessionSocketService, combatSocketService);

    socketService.on<CombatResultPayload>(CombatEvents.CombatResult, (data) => {
        handleCombatResult(data, service, gameSessionSocketService, combatSocketService);
    });
    socketService.on<{
        position: Position, newDoorState: string, remainingActions: number, interactionType: string,
        newLife?: number, newAttack?: number, newDefense?: number
    }>
        (GameSessionEvents.InteractResult, (data) => {
            const session = gameSessionSocketService.currentSession();
            if (data.interactionType === 'door') {
                const currentMap = service.mapCopy();
                if (currentMap) {
                    currentMap.mapConfig.tiles[data.position.y][data.position.x].doorState = data.newDoorState;
                    service.mapCopy.set({ ...currentMap });
                }
            } else if (data.interactionType === 'healingsanctuary' || data.interactionType === 'combatsanctuary') {
                const currentMap = service.mapCopy();
                if (currentMap) {
                    const originPos = findSanctuaryOrigin(data.position, currentMap.mapConfig.tiles);
                    if (originPos) {
                        currentMap.mapConfig.tiles[originPos.y][originPos.x].sanctuaryCooldown = SANCTUARY_COOLDOWN_TURNS;
                        service.mapCopy.set({ ...currentMap });
                    }
                }
            }
            if (session) {
                const currentPlayerId = service.currentPlayerTurn();
                const player = session.players.find(p => p.character.id === currentPlayerId);
                if (player) {
                    player.character.remainingActions = data.remainingActions;
                    if (data.newLife !== undefined) {
                        player.character.life = data.newLife;
                    }
                    if (data.newAttack !== undefined) {
                        player.character.attack = data.newAttack;
                    }
                    if (data.newDefense !== undefined) {
                        player.character.defense = data.newDefense;
                    }
                    gameSessionSocketService.currentSession.set({ ...session });

                }
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
            combatSocketService.activeCombat.set(null);
            gameSessionSocketService.currentSession.set({ ...session });
        }
    });

    socketService.on<{
        winner:
        { id: string; name: string; avatarId: number } | null; winningTeam?: 'team1' | 'team2'; gameMode?: string; reason: string; players?: Player[];
    }>(
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
                if (data.gameMode === 'ctf' && data.winningTeam) {
                    const teamName = data.winningTeam === 'team1' ? 'bleue' : 'rouge';
                    title = 'Victoire!';
                    message = `L'équipe ${teamName} a gagné la partie!`;
                } else {
                    const mySocketId = service.getSocketId();
                    if (data.winner.id === mySocketId) {
                        title = 'Victoire!';
                        message = 'Félicitations! Vous avez gagné la partie avec 3 victoires!';
                    } else {
                        title = 'Partie terminée';
                        message = `${data.winner.name} a gagné la partie avec 3 victoires!`;
                    }
                }
            } else if (data.reason === 'noPlayers') {
                message = 'La partie est terminée car tous les autres joueurs ont abandonné.';
            } else if (data.reason === 'canceled') {
                title = 'Partie annulée';
                message = 'La partie a été annulée car une équipe n\'a plus aucun joueur.';
            } else {
                message = 'La partie est terminée.';
            }

            const delay = data.gameMode === 'ctf' && data.reason === 'victory' ? CTF_VICTORY_ANNOUNCE_DELAY : gameSessionSocketService.endGameDelay;

            setTimeout(() => {
                if (data.reason === 'victory') {
                    const session = service.currentSession();
                    const tiles= service.mapCopy()?.mapConfig.tiles;
                    const walkableTiles= tiles?.flat().filter(t => 
                        t.type === TileType.Base || t.type === TileType.Water || t.type === TileType.Ice).length;
                    service.gameEnded.set(false);
                    gameSessionSocketService.currentSession.set(null);
                    router.navigate(['/game-statistics'],{
                        state:{
                            players: [...(data.players ?? session?.players ?? []), ...(session?.leftPlayers ?? [])],
                            winner : data.winner,
                            winningTeam: data.winningTeam,
                            gameMode: data.gameMode,
                            walkableTiles,
                        },
                    });
                }else{
                    router.navigate(['/']).then(() => {
                        dialog.open(AppDialogComponent, {
                            data: { title, message, type: data.reason === 'victory' ? 'info' : 'info' },
                            disableClose: true,
                        });
                        service.gameEnded.set(false);
                        gameSessionSocketService.currentSession.set(null);
                    });
                }
            }, delay);
        },
    );

    socketService.on<{ isDebugModeActivated: boolean }>(GameSessionEvents.ToggleDebugMode, (data) => {
        service.isDebugModeActivated.set(data.isDebugModeActivated);
    });

    socketService.on<{ fromPlayerId: string; fromPlayerName: string }>(GameSessionEvents.RequestFlagTransfer, (data) => {
        const mySocketId = service.getSocketId();
        const session = gameSessionSocketService.currentSession();
        if (!session) return;

        const toPlayer = session.players.find(p => p.socketId === mySocketId);
        if (!toPlayer) return;

        const dialogRef = dialog.open(AppDialogComponent, {
            data: {
                title: 'Demande de transfert de drapeau',
                message: `${data.fromPlayerName} veut vous transférer le drapeau. Acceptez-vous?`,
                type: 'warning',
                confirmText: 'Accepter',
                cancelText: 'Refuser',
            },
        });

        flagTransferService.setPendingFlagTransferDialog(toPlayer.character.id, dialogRef, data.fromPlayerId);

        dialogRef.afterClosed().subscribe((accepted: boolean) => {
            flagTransferService.removePendingFlagTransferDialog(toPlayer.character.id);
            service.respondToFlagTransfer(data.fromPlayerId, accepted ?? false);
        });
    });

    socketService.on<GameSession>(GameSessionEvents.GameSessionUpdated, (updatedGameSession) => {
        if (updatedGameSession) {
            gameSessionSocketService.currentSession.set({ ...updatedGameSession });
        }
    });
}

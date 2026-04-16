import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { GameSession } from '@app/domain/game-session';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { LogService } from '@app/services/log/log.service';
import { Player } from '@common/player';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SessionStatus } from '@common/session.status';
import { GameModeValue } from '@common/constants/game-config-constants';

@Injectable()
export class GamePlayAbandonHandler {
    constructor(
        @Inject(forwardRef(() => GameSessionService))
        private readonly gameSessionService: GameSessionService,
        private readonly logService: LogService,
        @Inject(forwardRef(() => GameSessionGateway))
        private readonly gameSessionGateway: GameSessionGateway,
    ) {}

    handlePlayerAbandoned(socket: Socket, payload: { roomId: string }, context: GamePlayHandlerContext): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.status !== SessionStatus.Playing) return;

        const currentPlayer = gameSession.getCurrentPlayer();
        const abandoningPlayer = gameSession.players.find(p => p.socketId === socket.id);
        const wasCurrentPlayer = currentPlayer && abandoningPlayer && currentPlayer.id === abandoningPlayer.character.id;

        this.handleAbandonedPlayerFlagPlacement(gameSession, abandoningPlayer);
        const combatInterrupted = this.handleAbandonedPlayerCombatCleanup(gameSession, payload.roomId, abandoningPlayer?.character.id, context);

        this.gameSessionService.removePlayer(payload.roomId, socket.id);
        socket.leave(payload.roomId);
        this.gameSessionGateway.clearSocketRoomTracking(socket.id);

        context.server.to(payload.roomId).emit(GameSessionEvents.PlayerAbandoned, {
            playerId: abandoningPlayer?.character.id,
            mapCopyTiles: gameSession.mapCopy?.tiles,
            flagPosition: gameSession.flagPosition,
            flagHolderId: gameSession.flagHolderId,
        });

        if (abandoningPlayer) {
            this.logService.log(payload.roomId, `Abandon de partie par ${abandoningPlayer.character.name}`);
        }

        if (this.handleAbandonedPlayerPostRemovalState(gameSession, context)) return;

        if (wasCurrentPlayer) {
            context.onTurnEnd(gameSession);
        } else if (combatInterrupted) {
            context.emitReachableTiles(gameSession);
            context.resumeTurn(gameSession);
        }
    }

    private handleAbandonedPlayerFlagPlacement(gameSession: GameSession, abandoningPlayer: Player | undefined): void {
        if (!abandoningPlayer || gameSession.gameMode !== GameModeValue.Ctf) {
            return;
        }

        if (gameSession.flagHolderId === abandoningPlayer.character.id) {
            gameSession.dropFlag(abandoningPlayer.character.position);
        }
    }

    private handleAbandonedPlayerCombatCleanup(gameSession: GameSession, roomId: string,
         abandonedPlayerId: string | undefined, context: GamePlayHandlerContext): boolean {
        const combat = gameSession.getActiveCombat();
        if (!combat || !abandonedPlayerId || !gameSession.isPlayerInActiveCombat(abandonedPlayerId)) {
            return false;
        }
        const survivorId = combat.attackerId === abandonedPlayerId ? combat.defenderId : combat.attackerId;
        const survivor = gameSession.getCharacterById(survivorId);
        const leaver = gameSession.getCharacterById(abandonedPlayerId);
        if (survivor) survivor.victories = (survivor.victories ?? 0) + 1;
        if (leaver) leaver.defeats = (leaver.defeats ?? 0) + 1;
        gameSession.clearActiveCombat();
        context.server.to(roomId).emit(CombatEvents.CombatEnded, {
            reason: 'playerLeft',
            abandonedPlayerId,
            survivorId,
            survivorVictories: survivor?.victories,
        });
        return true;
    }

    private handleAbandonedPlayerPostRemovalState(gameSession: GameSession, context: GamePlayHandlerContext): boolean {
        const hasHumanPlayersRemaining = gameSession.players.some(p => !p.virtualProfile);
        if (!hasHumanPlayersRemaining) {
            this.endCurrentTurnBeforeGameEndIfPossible(gameSession);
            context.onGameEnd(gameSession, null);
            return true;
        }
        if (!this.handleAbandonedPlayerTeamCheck(gameSession, context)) return true;
        if (!this.handleAbandonedPlayerWinnerCheck(gameSession, context)) return true;
        return this.handleAbandonedPlayerEmptyGame(gameSession, context);
    }

    private handleAbandonedPlayerTeamCheck(gameSession: GameSession, context: GamePlayHandlerContext): boolean {
        if (gameSession.gameMode === GameModeValue.Ctf) {
            const team1Count = gameSession.getTotalPlayersInTeam('team1');
            const team2Count = gameSession.getTotalPlayersInTeam('team2');
            if (team1Count === 0 || team2Count === 0) {
                context.onGameEndCanceled(gameSession);
                return false;
            }
        }
        return true;
    }

    private handleAbandonedPlayerWinnerCheck(gameSession: GameSession, context: GamePlayHandlerContext): boolean {
        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) {
            this.endCurrentTurnBeforeGameEndIfPossible(gameSession);
            context.onGameEnd(gameSession, winner);
            return false;
        }
        return true;
    }

    private handleAbandonedPlayerEmptyGame(gameSession: GameSession, context: GamePlayHandlerContext): boolean {
        if (gameSession.playerOrder.length <= 1) {
            this.endCurrentTurnBeforeGameEndIfPossible(gameSession);
            context.onGameEnd(gameSession, null);
            return true;
        }
        return false;
    }

    private endCurrentTurnBeforeGameEndIfPossible(gameSession: GameSession): void {
        if (gameSession.playerOrder.length > 0) {
            this.gameSessionService.endCurrentTurn(gameSession);
        }
    }
}
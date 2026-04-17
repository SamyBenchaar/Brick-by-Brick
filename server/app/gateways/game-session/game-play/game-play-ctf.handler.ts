import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { LogService } from '@app/services/log/log.service';
import { GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GamePlayCtfHandler {
    constructor(
        @Inject(forwardRef(() => GameSessionService))
        private readonly gameSessionService: GameSessionService,
        private readonly logService: LogService,
    ) {}

    handleRequestFlagTransfer(
        socket: Socket,
        payload: { roomId: string; toPlayerId: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) return;

        const fromPlayer = gameSession.players.find(player => player.socketId === socket.id);
        const toPlayer = gameSession.players.find(player => player.character.id === payload.toPlayerId);

        if (!fromPlayer || !toPlayer) return;
        if (!this.validateFlagTransferRequest(gameSession, fromPlayer, toPlayer)) return;

        gameSession.createFlagTransferRequest(fromPlayer.character.id, toPlayer.character.id);

        if (toPlayer.virtualProfile) {
            gameSession.acceptFlagTransfer(toPlayer.character.id);

            if (fromPlayer.character.remainingActions) {
                fromPlayer.character.remainingActions -= 1;
            }
            this.logService.log(payload.roomId, `Drapeau transféré par ${fromPlayer.character.name} à ${toPlayer.character.name}`);
            context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);

            const fromCurrentPlayer = gameSession.getCurrentPlayer();
            if (fromCurrentPlayer?.id === fromPlayer.character.id && !this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            }
            return;
        }

        context.server.to(toPlayer.socketId).emit(GameSessionEvents.RequestFlagTransfer, {
            fromPlayerId: fromPlayer.character.id,
            fromPlayerName: fromPlayer.character.name,
        });
    }

    private validateFlagTransferRequest(gameSession: GameSession, fromPlayer: Player, toPlayer: Player): boolean {
        if (fromPlayer.character.team !== toPlayer.character.team) return false;

        if (!fromPlayer.character.position || !toPlayer.character.position) return false;
        const distance = Math.abs(fromPlayer.character.position.x - toPlayer.character.position.x) +
            Math.abs(fromPlayer.character.position.y - toPlayer.character.position.y);
        if (distance !== 1) return false;

        const fromHasFlag = fromPlayer.character.hasFlag;
        const toHasFlag = toPlayer.character.hasFlag;

        const hasSameFlagState = fromHasFlag === toHasFlag;

        if (hasSameFlagState) return false;

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || fromPlayer.character.id !== currentPlayer.id) return false;
        if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

        return true;
    }

    handleFlagTransferResponse(
        socket: Socket,
        payload: { roomId: string; fromPlayerId: string; accepted: boolean },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) return;

        const toPlayer = gameSession.players.find(player => player.socketId === socket.id);
        if (!toPlayer) return;

        const flagTransferRequest = gameSession.getFlagTransferRequest(toPlayer.character.id);
        if (!flagTransferRequest) return;

        const fromPlayer = gameSession.players.find(player => player.character.id === payload.fromPlayerId);

        if (payload.accepted) {
            gameSession.acceptFlagTransfer(toPlayer.character.id);

            if (fromPlayer && fromPlayer.character.remainingActions) {
                fromPlayer.character.remainingActions -= 1;
            }

            context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
            context.logService.log(payload.roomId, `Transfert de drapeau de ${fromPlayer.character.name} à ${toPlayer.character.name}`);

            const fromCurrentPlayer = gameSession.getCurrentPlayer();
            if (fromCurrentPlayer?.id === payload.fromPlayerId && !this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
            }
        } else {
            gameSession.rejectFlagTransfer(toPlayer.character.id);

            if (fromPlayer && fromPlayer.character.remainingActions) {
                fromPlayer.character.remainingActions -= 1;
            }

            context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }
    }
}

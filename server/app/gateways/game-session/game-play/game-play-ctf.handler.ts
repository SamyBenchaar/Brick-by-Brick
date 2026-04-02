import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GamePlayCtfHandler {
    constructor(private readonly gameSessionService: GameSessionService) {}

    handleRequestFlagTransfer(
        socket: Socket,
        payload: { roomId: string; toPlayerId: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) return;

        const fromPlayer = gameSession.players.find(p => p.socketId === socket.id);
        const toPlayer = gameSession.players.find(p => p.character.id === payload.toPlayerId);

        if (!fromPlayer || !toPlayer) return;
        if (!this.validateFlagTransferRequest(gameSession, fromPlayer, toPlayer)) return;

        gameSession.createFlagTransferRequest(fromPlayer.character.id, toPlayer.character.id);
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
        if ((fromHasFlag && toHasFlag) || (!fromHasFlag && !toHasFlag)) return false;

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

        const toPlayer = gameSession.players.find(p => p.socketId === socket.id);
        if (!toPlayer) return;

        const flagTransferRequest = gameSession.getFlagTransferRequest(toPlayer.character.id);
        if (!flagTransferRequest) return;

        if (payload.accepted) {
            gameSession.acceptFlagTransfer(toPlayer.character.id);

            const fromPlayer = gameSession.players.find(p => p.character.id === payload.fromPlayerId);
            if (fromPlayer && fromPlayer.character.remainingActions !== undefined) {
                fromPlayer.character.remainingActions -= 1;
            }

            context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        } else {
            gameSession.rejectFlagTransfer(toPlayer.character.id);
            context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }
    }
}

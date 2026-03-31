import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { GameSessionEvents } from '@common/game.events';
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
        if (!fromPlayer) return;

        const toPlayer = gameSession.players.find(p => p.character.id === payload.toPlayerId);
        if (!toPlayer || fromPlayer.character.team !== toPlayer.character.team) return;

        const fromHasFlag = fromPlayer.character.hasFlag;
        const toHasFlag = toPlayer.character.hasFlag;

        if ((fromHasFlag && toHasFlag) || (!fromHasFlag && !toHasFlag)) return;

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) return;
        const isCurrentTeam = fromPlayer.character.team === currentPlayer.team;
        if (!isCurrentTeam) return;

        gameSession.createFlagTransferRequest(fromPlayer.character.id, toPlayer.character.id);
        context.server.to(toPlayer.socketId).emit(GameSessionEvents.RequestFlagTransfer, {
            fromPlayerId: fromPlayer.character.id,
            fromPlayerName: fromPlayer.character.name,
        });
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

        if (payload.accepted) {
            gameSession.acceptFlagTransfer(toPlayer.character.id);
        } else {
            gameSession.rejectFlagTransfer(toPlayer.character.id);
        }

        context.server.to(payload.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
    }
}

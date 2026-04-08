import { GameSession } from '@app/domain/game-session';
import { TileDto } from '@app/dto/tile.dto';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GamePlayMovementHandler {
    constructor(
        private readonly gameSessionService: GameSessionService,
        private readonly movementService: MovementService,
    ) {}

    handleRequestMove(
        socket: Socket,
        payload: { roomId: string; direction: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting || gameSession.getActiveCombat()) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return;
        }

        const direction = payload.direction as 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';
        const success = this.gameSessionService.executeMove(gameSession, direction);

        if (success) {
            context.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
                playerId: currentPlayer.id,
                position: currentPlayer.position,
                remainingMovement: currentPlayer.remainingMovement,
                remainingActions: currentPlayer.remainingActions,
            });

            if (gameSession.gameMode === 'ctf') {
                const ctfGameEnded = this.handleCtfMovement(gameSession, context, payload.roomId);
                if (ctfGameEnded) {
                    return;
                }
            }

            context.emitReachableTiles(gameSession);

            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            }
        }
    }

    private handleCtfMovement(
        gameSession: GameSession,
        context: GamePlayHandlerContext,
        roomId: string,
    ): boolean {
        const flagPos = gameSession.getFlagPosition();
        const currentPlayer = gameSession.getCurrentPlayer();

        if (!gameSession.getFlagHolder() && flagPos && currentPlayer.position?.x === flagPos.x && currentPlayer.position?.y === flagPos.y) {
            gameSession.setFlagHolder(currentPlayer.id);
            context.server.to(roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        const flagHolder = gameSession.getFlagHolderCharacter();
        if (flagHolder) {
            const flagHolderStarting = gameSession.getStartingPoint(flagHolder.id);
            if (flagHolderStarting && flagHolder.position?.x === flagHolderStarting.x && flagHolder.position?.y === flagHolderStarting.y) {
                context.onGameEnd(gameSession, flagHolder);
                return true;
            }
        }

        return false;
    }

    handleRequestAssignPosition(
        socket: Socket,
        payload: { roomId: string; position: Position },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.isTurnStarting || gameSession.getActiveCombat()) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer) {
            return;
        }

        this.movementService.assignPosition(currentPlayer, gameSession, payload.position);
        context.server.to(payload.roomId).emit(GameSessionEvents.MoveExecuted, {
            playerId: currentPlayer.id,
            position: currentPlayer.position,
            remainingMovement: currentPlayer.remainingMovement,
            remainingActions: currentPlayer.remainingActions,
        });
        context.emitReachableTiles(gameSession);
    }

    handleRequestInteract(
        socket: Socket,
        payload: { roomId: string; position: Position },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || gameSession.isTurnStarting || gameSession.getActiveCombat()) return;

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);

        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) return;
        if ((currentPlayer.remainingActions ?? 0) <= 0) return;

        const tile = gameSession.mapCopy?.tiles[payload.position.y]?.[payload.position.x];
        if (!tile) return;

        if (tile.type === 'door') {
            this.handleDoorInteraction(gameSession, tile, payload.position, currentPlayer, context);
        } else {
            return;
        }

        context.emitReachableTiles(gameSession);

        if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
            this.gameSessionService.endCurrentTurn(gameSession);
            context.onTurnEnd(gameSession);
        }
    }

    private handleDoorInteraction(
        gameSession: GameSession,
        tile: TileDto,
        position: Position,
        currentPlayer: Character,
        context: GamePlayHandlerContext,
    ): void {
        tile.doorState = tile.doorState === 'opened' ? 'closed' : 'opened';
        currentPlayer.remainingActions -= 1;

        context.server.to(gameSession.roomId).emit(GameSessionEvents.InteractResult, {
            position,
            interactionType: 'door',
            newDoorState: tile.doorState,
            remainingActions: currentPlayer.remainingActions,
        });

        const action = tile.doorState === 'opened' ? 'Ouverture' : 'Fermeture';
        context.logService.log(gameSession.roomId, `${action} d'une porte par ${currentPlayer.name}`);
    }
}

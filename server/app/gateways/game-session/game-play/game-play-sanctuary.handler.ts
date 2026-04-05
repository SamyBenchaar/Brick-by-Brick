import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { Position } from '@common/position';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import {MapTile} from '@app/interfaces/game-map-interfaces';
import { DOUBLE_SANCTUARY_BONUS_CHANCE,
        DOUBLE_SANCTUARY_BONUS,
        COMBAT_SANCTUARY_BONUS,
        HEALING_SANCTUARY_BONUS,
        SANCTUARY_COOLDOWN_TURNS } from '@common/constants/santuary-constants';

@Injectable()
export class GamePlaySanctuaryHandler {
    constructor(
    private readonly gameSessionService: GameSessionService) {}

    handleRequestInteract(socket: Socket,payload: { roomId: string; position: Position; mode: 'normal' | 'double' },
        context: GamePlayHandlerContext): void {
            const gameSession = this.gameSessionService.getGameSession(payload.roomId);
            if (!gameSession || gameSession.isTurnStarting) return;

            const currentPlayer = gameSession.getCurrentPlayer();
            const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);

            if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) return;
            if ((currentPlayer.remainingActions ?? 0) <= 0) return;

            const interactionType = this.processInteraction(gameSession.mapCopy?.tiles, currentPlayer, payload.position, payload.mode);
            if (!interactionType) return;

            currentPlayer.remainingActions -= 1;
            context.server.to(gameSession.roomId).emit(GameSessionEvents.InteractResult, {
                position: payload.position,
                interactionType,
                playerId: currentPlayer.id,
                newLife: currentPlayer.life,
                newAttack: currentPlayer.attack,
                newDefense: currentPlayer.defense,
                remainingActions: currentPlayer.remainingActions,
            });
            
            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            }
        }

        private processInteraction(tiles: MapTile[][] | undefined, player: Character, position: Position, mode: 'normal' | 'double'): string | null {
            if (!tiles) return null;

            const tile = tiles[position.y]?.[position.x];
            if (!tile?.object) return null;

            const objectType = tile.object.type;
            const origin = tile.sanctuaryOrigin;
            if (!origin) return null;

            const originTile = tiles[origin.y]?.[origin.x];
            if (!originTile || (originTile.sanctuaryCooldown ?? 0) > 0) return null;

            const applied = this.applyEffect(player, objectType, mode);
            if (!applied) return null;

            originTile.sanctuaryCooldown = SANCTUARY_COOLDOWN_TURNS;
            return objectType;
        }

        private applyEffect(player: Character, objectType: string, mode: 'normal' | 'double'): boolean {
            if (objectType === 'healingsanctuary') {
                this.handleHealingSanctuary(player, mode);
                return true;
            }
            if (objectType === 'combatsanctuary') {
                if (player.combatSanctuaryBonus !== undefined) return false;
                this.handleCombatSanctuary(player, mode);
                return true;
            }
            return false;
        }


        private handleHealingSanctuary(player: Character, mode: 'normal' | 'double'): void {
            if (mode === 'double') {
                if (Math.random() < DOUBLE_SANCTUARY_BONUS_CHANCE) {
                    player.life = Math.min(player.life + HEALING_SANCTUARY_BONUS * DOUBLE_SANCTUARY_BONUS, player.maxLife);
                }
            } else {
                player.life = Math.min(player.life + HEALING_SANCTUARY_BONUS, player.maxLife);
            }
        }
        private handleCombatSanctuary(player: Character, mode: 'normal' | 'double'): void {
            if (mode === 'double') {
                if (Math.random() < DOUBLE_SANCTUARY_BONUS_CHANCE) {
                    const bonus = COMBAT_SANCTUARY_BONUS * DOUBLE_SANCTUARY_BONUS;
                    player.attack += bonus;
                    player.defense += bonus;
                    player.combatSanctuaryBonus = bonus;
                    player.hasCombatSanctuaryBonus = true;
                }
            } else {
                player.attack += COMBAT_SANCTUARY_BONUS;
                player.defense += COMBAT_SANCTUARY_BONUS;
                player.hasCombatSanctuaryBonus = true;
                player.combatSanctuaryBonus = COMBAT_SANCTUARY_BONUS;
            }
        }

    
}

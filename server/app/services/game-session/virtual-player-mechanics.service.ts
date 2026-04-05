import { GameSession } from '@app/domain/game-session';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { COMBAT_SANCTUARY_BONUS, HEALING_SANCTUARY_BONUS } from '@common/constants/santuary-constants';
import { GameSessionEvents, CombatEvents } from '@common/game.events';
import { DoorState, ObjectType, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Inject, Injectable } from '@nestjs/common';
import { CombatService } from './combat.service';
import { MovementService } from './movement.service';
import { VirtualPlayerPathfindingService } from './virtual-player-mechanics/virtual-player-pathfinding.service';
import { VirtualPlayerTargetingService } from './virtual-player-mechanics/virtual-player-targeting.service';
import { LogService } from '@app/services/log/log.service';

@Injectable()
export class VirtualPlayerMechanicsService {
    @Inject() private readonly combatService: CombatService;
    @Inject() private readonly movementService: MovementService;
    @Inject() private readonly gameGateway: GameGateway;
    @Inject() private readonly pathfinding: VirtualPlayerPathfindingService;
    @Inject() private readonly targeting: VirtualPlayerTargetingService;
    @Inject() private readonly logService: LogService;

    private readonly minActionDelayMs = 500;
    private readonly actionDelayRangeMs = 1000;

    canMove(bot: Player): boolean {
        return (bot.character.remainingMovement ?? 0) > 0;
    }

    hasAction(bot: Player): boolean {
        return (bot.character.remainingActions ?? 0) > 0;
    }

    canContinueTurn(bot: Player): boolean {
        return this.canMove(bot) || this.hasAction(bot);
    }

    hasFlag(bot: Player): boolean {
        return !!bot.character.hasFlag;
    }

    samePosition(a: Position, b: Position): boolean {
        return this.pathfinding.samePosition(a, b);
    }

    findNearestEnemy(session: GameSession, bot: Player): Player | null {
        return this.targeting.findNearestEnemy(session, bot);
    }

    findEnemyFlagHolder(session: GameSession, bot: Player): Player | null {
        return this.targeting.findEnemyFlagHolder(session, bot);
    }

    getOwnStartingPoint(session: GameSession, bot: Player): Position | null {
        return this.targeting.getOwnStartingPoint(session, bot);
    }

    getFlagPosition(session: GameSession): Position | null {
        return this.targeting.getFlagPosition(session);
    }

    findNearestWalkableTile(session: GameSession, bot: Player, target: Position): Position | null {
        return this.targeting.findNearestWalkableTile(session, bot, target);
    }

    async tryAttackSpecificAdjacent(session: GameSession, bot: Player, target: Player): Promise<boolean> {
        if (!this.hasAction(bot) || !bot.character.position || !target.character.position) {
            return false;
        }

        const distance = Math.abs(target.character.position.x - bot.character.position.x)
            + Math.abs(target.character.position.y - bot.character.position.y);

        if (distance !== 1) {
            return false;
        }

        const mapCopy = session.getMapCopy();
        if (!mapCopy) {
            return false;
        }

        await this.randomDelay();
        const result = this.combatService.executeCombat(
            session,
            bot.character,
            target.character,
            mapCopy,
        );

        this.gameGateway.notifyRoomEvent(session.roomId, CombatEvents.CombatResult, {
            winner: result.winner,
            loser: result.loser,
            attackerVictories: result.attackerVictories,
            defenderNewPosition: target.character.position,
            remainingActions: bot.character.remainingActions,
        });

        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.GameSessionUpdated, session);
        return true;
    }

    findFleeTarget(session: GameSession, bot: Player, enemy: Player): Position | null {
        return this.targeting.findFleeTarget(session, bot, enemy);
    }

    async moveTowardEnemy(session: GameSession, bot: Player, enemy: Player): Promise<boolean> {
        const candidates = this.pathfinding.getNeighbors(enemy.character.position)
            .filter((position) => this.pathfinding.getMoveCost(session, position, bot) !== Infinity)
            .filter((position) => !this.samePosition(position, bot.character.position));

        if (candidates.length === 0) {
            return false;
        }

        let bestTarget: Position | null = null;
        let bestCost = Infinity;

        for (const candidate of candidates) {
            const pathInfo = this.pathfinding.buildShortestPath(session, bot, candidate);
            if (pathInfo && pathInfo.totalCost < bestCost) {
                bestTarget = candidate;
                bestCost = pathInfo.totalCost;
            }
        }

        if (!bestTarget) {
            return false;
        }

        return this.moveTowardPosition(session, bot, bestTarget);
    }

    async moveTowardPosition(session: GameSession, bot: Player, target: Position): Promise<boolean> {
        const pathInfo = this.pathfinding.buildShortestPath(session, bot, target);
        if (!pathInfo) {
            return false;
        }


        let moved = false;
        for (let i = 0; i < pathInfo.path.length;) {
            const next = pathInfo.path[i];
            if (!this.canMove(bot) || !bot.character.position) {
                break;
            }

            const direction = this.pathfinding.getDirection(bot.character.position, next);
            if (!direction) {
                break;
            }

            await this.randomDelay();
            const mapData = session.getMapCopy()?.tiles;
            if (!mapData) {
                return moved;
            }

            const didMove = this.movementService.executeMove(
                session,
                bot.character,
                direction,
                mapData,
            );

            if (!didMove) {
                const openedDoor = await this.tryOpenDoorAtPosition(session, bot, next);
                if (openedDoor) {
                    continue;
                }
                break;
            }

            this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.MoveExecuted, {
                playerId: bot.character.id,
                position: bot.character.position,
                remainingMovement: bot.character.remainingMovement,
                remainingActions: bot.character.remainingActions,
            });

            this.handleCtfFlagPickup(session, bot);

            moved = true;
            i++;
        }

        return moved;
    }

    async tryAttackAdjacent(session: GameSession, bot: Player): Promise<boolean> {
        if (!this.hasAction(bot)) {
            return false;
        }

        const target = this.targeting.getAdjacentEnemy(session, bot);
        if (!target) {
            return false;
        }

        const mapCopy = session.getMapCopy();
        if (!mapCopy) {
            return false;
        }

        await this.randomDelay();
        const result = this.combatService.executeCombat(
            session,
            bot.character,
            target.character,
            mapCopy,
        );

        this.gameGateway.notifyRoomEvent(session.roomId, CombatEvents.CombatResult, {
            winner: result.winner,
            loser: result.loser,
            attackerVictories: result.attackerVictories,
            defenderNewPosition: target.character.position,
            remainingActions: bot.character.remainingActions,
        });

        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.GameSessionUpdated, session);

        return true;
    }

    async tryUseAdjacentSanctuary(session: GameSession, bot: Player): Promise<boolean> {
        if (!this.hasAction(bot) || !bot.character.position) {
            return false;
        }

        const sanctuaryPosition = this.findAdjacentSanctuaryTile(session, bot.character.position);
        if (!sanctuaryPosition) {
            return false;
        }

        const tile = session.getMapCopy()?.tiles?.[sanctuaryPosition.y]?.[sanctuaryPosition.x];
        if (!tile?.object) {
            return false;
        }

        if (tile.object.type === ObjectType.CombatSanctuary && bot.character.hasCombatSanctuaryBonus) {
            return false;
        }

        if (tile.object.type === ObjectType.HealingSanctuary) {
            bot.character.life = Math.min(bot.character.life + HEALING_SANCTUARY_BONUS, bot.character.maxLife);
        } else if (tile.object.type === ObjectType.CombatSanctuary) {
            bot.character.attack += COMBAT_SANCTUARY_BONUS;
            bot.character.defense += COMBAT_SANCTUARY_BONUS;
            bot.character.hasCombatSanctuaryBonus = true;
            bot.character.combatSanctuaryBonus = COMBAT_SANCTUARY_BONUS;
        } else {
            return false;
        }

        await this.randomDelay();
        bot.character.remainingActions = (bot.character.remainingActions ?? 0) - 1;

        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.InteractResult, {
            position: sanctuaryPosition,
            interactionType: tile.object.type,
            playerId: bot.character.id,
            newLife: bot.character.life,
            newAttack: bot.character.attack,
            newDefense: bot.character.defense,
            remainingActions: bot.character.remainingActions,
        });

        return true;
    }

    private findAdjacentSanctuaryTile(session: GameSession, botPosition: Position): Position | null {
        const tiles = session.getMapCopy()?.tiles;
        if (!tiles) {
            return null;
        }

        const adjacentPositions = this.pathfinding.getNeighbors(botPosition);
        for (const position of adjacentPositions) {
            const tile = tiles[position.y]?.[position.x];
            if (!tile) {
                continue;
            }

            if (tile.object?.type === ObjectType.HealingSanctuary || tile.object?.type === ObjectType.CombatSanctuary) {
                return position;
            }
        }

        return null;
    }

    private handleCtfFlagPickup(session: GameSession, bot: Player): void {
        if (session.gameMode !== 'ctf' || !bot.character.position || session.getFlagHolder()) {
            return;
        }

        const flagPosition = session.getFlagPosition();
        if (!flagPosition) {
            return;
        }

        if (!this.samePosition(bot.character.position, flagPosition)) {
            return;
        }

        session.setFlagHolder(bot.character.id);
        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.GameSessionUpdated, session);
    }

    private async tryOpenDoorAtPosition(session: GameSession, bot: Player, doorPosition: Position): Promise<boolean> {
        if (!this.hasAction(bot) || !bot.character.position) {
            return false;
        }

        const distance = Math.abs(bot.character.position.x - doorPosition.x)
            + Math.abs(bot.character.position.y - doorPosition.y);
        if (distance !== 1) {
            return false;
        }

        const tile = session.getMapCopy()?.tiles?.[doorPosition.y]?.[doorPosition.x];
        if (!tile || tile.type !== TileType.Door || tile.doorState === DoorState.Opened) {
            return false;
        }

        await this.randomDelay();
        tile.doorState = DoorState.Opened;
        bot.character.remainingActions = (bot.character.remainingActions ?? 0) - 1;

        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.InteractResult, {
            position: doorPosition,
            interactionType: 'door',
            newDoorState: tile.doorState,
            remainingActions: bot.character.remainingActions,
        });
        this.logService.log(session.roomId, `Ouverture d'une porte par ${bot.character.name}`);

        return true;
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * this.actionDelayRangeMs) + this.minActionDelayMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}
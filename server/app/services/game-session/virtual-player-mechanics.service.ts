import { GameSession } from '@app/domain/game-session';
import { GamePlayGateway } from '@app/gateways/game-session/game-play/game-play.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { LogService } from '@app/services/log/log.service';
import { GameModeValue } from '@common/constants/game-config-constants';
import { COMBAT_SANCTUARY_BONUS, HEALING_SANCTUARY_BONUS, SANCTUARY_COOLDOWN_TURNS } from '@common/constants/santuary-constants';
import { GameSessionEvents } from '@common/game.events';
import { DoorState, ObjectType, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import { MovementService } from './movement.service';
import { VirtualPlayerPathfindingService } from './virtual-player-mechanics/virtual-player-pathfinding.service';
import { VirtualPlayerTargetingService } from './virtual-player-mechanics/virtual-player-targeting.service';

@Injectable()
export class VirtualPlayerMechanicsService {
    @Inject() private readonly movementService: MovementService;
    @Inject() private readonly gameGateway: GameGateway;
    @Optional()
    @Inject(forwardRef(() => GamePlayGateway))
    private readonly gamePlayGateway?: GamePlayGateway;
    @Inject() private readonly pathfinding: VirtualPlayerPathfindingService;
    @Inject() private readonly targeting: VirtualPlayerTargetingService;
    @Inject() private readonly logService: LogService;

    private readonly minActionDelayMs = 500;
    private readonly actionDelayRangeMs = 1000;

    isBotCurrentPlayer(session: GameSession, bot: Player): boolean {
        return session.getCurrentPlayer()?.id === bot.character.id;
    }

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

    async selectCombatPosture(profile: string): Promise<string> {
        await this.randomDelay();
        return profile === 'aggressive' ? 'offensive' : 'defensive';
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

    private isAttackPossible(session: GameSession, bot: Player, target: Player): boolean {
        const isReady = this.isBotCurrentPlayer(session, bot) && this.hasAction(bot);
        const hasPositions = !!bot.character.position && !!target.character.position;
        return isReady && hasPositions;
    }

    async tryAttackSpecificAdjacent(session: GameSession, bot: Player, target: Player): Promise<boolean> {
        if (!this.isAttackPossible(session, bot, target)) {
            return false;
        }

        const distance = Math.abs(target.character.position.x - bot.character.position.x)
            + Math.abs(target.character.position.y - bot.character.position.y);

        if (distance !== 1) {
            return false;
        }

        await this.randomDelay();
        if (!this.isBotCurrentPlayer(session, bot) || !this.hasAction(bot)) {
            return false;
        }

        if (!this.gamePlayGateway) {
            return false;
        }

        this.gamePlayGateway.triggerBotCombat(session.roomId, bot.character.id, target.character.id);
        return !!session.getActiveCombat();
    }

    findFleeTarget(session: GameSession, bot: Player, enemy: Player): Position | null {
        return this.targeting.findFleeTarget(session, bot, enemy);
    }

    async moveTowardEnemy(session: GameSession, bot: Player, enemy: Player): Promise<boolean> {
        if (!this.isBotCurrentPlayer(session, bot)) {
            return false;
        }

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
        if (!this.isBotCurrentPlayer(session, bot)) {
            return false;
        }

        const pathInfo = this.pathfinding.buildShortestPath(session, bot, target);
        if (!pathInfo) {
            return false;
        }


        let moved = false;
        for (let i = 0; i < pathInfo.path.length;) {
            const next = pathInfo.path[i];
            if (!this.isBotCurrentPlayer(session, bot) || !this.canMove(bot) || !bot.character.position) {
                break;
            }

            const direction = this.pathfinding.getDirection(bot.character.position, next);
            if (!direction) {
                break;
            }

            await this.randomDelay();
            if (!this.isBotCurrentPlayer(session, bot) || !this.canMove(bot) || !bot.character.position) {
                break;
            }
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
        if (session.gameMode === GameModeValue.Ctf) {
            return false;
        }

        const target = this.targeting.getAdjacentEnemy(session, bot);
        if (!target) {
            return false;
        }

        return this.tryAttackSpecificAdjacent(session, bot, target);
    }

    async tryUseAdjacentSanctuary(session: GameSession, bot: Player): Promise<boolean> {
        if (!this.canStartSanctuaryUse(session, bot)) {
            return false;
        }

        const sanctuaryData = this.findUsableAdjacentSanctuary(session, bot);
        if (!sanctuaryData) {
            return false;
        }

        this.applySanctuaryEffect(bot, sanctuaryData.type);

        const map = session.mapCopy;
        if (map && map.tiles) {
            const tile = map.tiles[sanctuaryData.position.y]?.[sanctuaryData.position.x];
            const origin = tile?.sanctuaryOrigin;
            if (origin) {
                const originTile = map.tiles[origin.y]?.[origin.x];
                if (originTile) {
                    originTile.sanctuaryCooldown = SANCTUARY_COOLDOWN_TURNS;
                }
            }
        }

        await this.randomDelay();
        if (!this.canFinalizeSanctuaryUse(session, bot)) {
            return false;
        }
        bot.character.remainingActions = (bot.character.remainingActions ?? 0) - 1;

        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.InteractResult, {
            position: sanctuaryData.position,
            interactionType: sanctuaryData.type,
            playerId: bot.character.id,
            newLife: bot.character.life,
            newAttack: bot.character.attack,
            newDefense: bot.character.defense,
            remainingActions: bot.character.remainingActions,
        });

        return true;
    }

    private canStartSanctuaryUse(session: GameSession, bot: Player): boolean {
        return this.isBotCurrentPlayer(session, bot) && this.hasAction(bot) && !!bot.character.position;
    }

    private canFinalizeSanctuaryUse(session: GameSession, bot: Player): boolean {
        return this.isBotCurrentPlayer(session, bot) && this.hasAction(bot);
    }

    private findUsableAdjacentSanctuary(
        session: GameSession,
        bot: Player,
    ): { position: Position; type: ObjectType.HealingSanctuary | ObjectType.CombatSanctuary } | null {
        const botPosition = bot.character.position;
        if (!botPosition) {
            return null;
        }

        const sanctuaryPosition = this.findAdjacentSanctuaryTile(session, botPosition);
        if (!sanctuaryPosition) {
            return null;
        }

        const tileObject = session.mapCopy?.tiles?.[sanctuaryPosition.y]?.[sanctuaryPosition.x]?.object;
        if (!tileObject) {
            return null;
        }

        const sanctuaryType = tileObject.type;
        if (!this.isSanctuaryTypeUsable(bot, sanctuaryType)) {
            return null;
        }

        return { position: sanctuaryPosition, type: sanctuaryType };
    }

    private isSanctuaryTypeUsable(bot: Player, sanctuaryType: string): sanctuaryType is ObjectType.HealingSanctuary | ObjectType.CombatSanctuary {
        if (sanctuaryType === ObjectType.HealingSanctuary) {
            return bot.character.life < bot.character.maxLife;
        }

        if (sanctuaryType === ObjectType.CombatSanctuary) {
            return !bot.character.hasCombatSanctuaryBonus;
        }

        return false;
    }

    private applySanctuaryEffect(bot: Player, sanctuaryType: ObjectType.HealingSanctuary | ObjectType.CombatSanctuary): void {
        if (sanctuaryType === ObjectType.HealingSanctuary) {
            bot.character.life = Math.min(bot.character.life + HEALING_SANCTUARY_BONUS, bot.character.maxLife);
            return;
        }

        bot.character.attack += COMBAT_SANCTUARY_BONUS;
        bot.character.defense += COMBAT_SANCTUARY_BONUS;
        bot.character.hasCombatSanctuaryBonus = true;
        bot.character.combatSanctuaryBonus = COMBAT_SANCTUARY_BONUS;
    }

    private findAdjacentSanctuaryTile(session: GameSession, botPosition: Position): Position | null {
        const tiles = session.mapCopy?.tiles;
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
                const origin = tile.sanctuaryOrigin;
                if (origin) {
                    const originTile = tiles[origin.y]?.[origin.x];
                    if (originTile && (originTile.sanctuaryCooldown ?? 0) === 0) {
                        return position;
                    }
                }
            }
        }

        return null;
    }

    private handleCtfFlagPickup(session: GameSession, bot: Player): void {
        if (session.gameMode !== GameModeValue.Ctf || !bot.character.position || session.getFlagHolder()) {
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
        this.logService.log(session.roomId, `Drapeau pris du sol par ${bot.character.name}`);
        this.gameGateway.notifyRoomEvent(session.roomId, GameSessionEvents.GameSessionUpdated, session);
    }

    private async tryOpenDoorAtPosition(session: GameSession, bot: Player, doorPosition: Position): Promise<boolean> {
        if (!this.isBotCurrentPlayer(session, bot) || !this.hasAction(bot) || !bot.character.position) {
            return false;
        }

        const distance = Math.abs(bot.character.position.x - doorPosition.x)
            + Math.abs(bot.character.position.y - doorPosition.y);
        if (distance !== 1) {
            return false;
        }

        const tile = session.mapCopy?.tiles?.[doorPosition.y]?.[doorPosition.x];
        if (!tile || tile.type !== TileType.Door || tile.doorState === DoorState.Opened) {
            return false;
        }

        await this.randomDelay();
        if (!this.isBotCurrentPlayer(session, bot) || !this.hasAction(bot)) {
            return false;
        }
        tile.doorState = DoorState.Opened;
        session.usedDoors.add(`${doorPosition.x},${doorPosition.y}`);
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
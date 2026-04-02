import { GameSession } from '@app/domain/game-session';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerPathfindingService } from './virtual-player-pathfinding.service';

@Injectable()
export class VirtualPlayerTargetingService {
    @Inject() private readonly pathfinding: VirtualPlayerPathfindingService;

    findNearestEnemy(session: GameSession, bot: Player): Player | null {
        const enemies = this.getEnemies(session, bot);
        if (enemies.length === 0 || !bot.character.position) {
            return null;
        }

        const distFromBot = this.pathfinding.dijkstra(session, bot);
        let bestEnemy: Player | null = null;
        let bestCost = Infinity;

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.character.position) {
                continue;
            }

            const adjacentTiles = this.pathfinding
                .getNeighbors(enemy.character.position)
                .filter((position) => this.pathfinding.getMoveCost(session, position, bot) !== Infinity);

            let enemyBest = Infinity;
            for (let j = 0; j < adjacentTiles.length; j++) {
                const tile = adjacentTiles[j];
                const cost = distFromBot.get(this.pathfinding.positionKey(tile))?.cost ?? Infinity;
                if (cost < enemyBest) {
                    enemyBest = cost;
                }
            }

            if (enemyBest < bestCost) {
                bestCost = enemyBest;
                bestEnemy = enemy;
            }
        }

        return bestEnemy;
    }

    findEnemyFlagHolder(session: GameSession, bot: Player): Player | null {
        const flagHolderId = session.getFlagHolder();
        if (!flagHolderId) {
            return null;
        }

        const flagHolder = session.players.find((player) => player.character.id === flagHolderId);
        if (!flagHolder || !flagHolder.character.position) {
            return null;
        }

        const botTeam = session.getPlayerTeam(bot.character.id);
        const holderTeam = session.getPlayerTeam(flagHolder.character.id);
        if (session.gameMode === 'ctf' && botTeam && holderTeam && botTeam === holderTeam) {
            return null;
        }

        return flagHolder;
    }

    getOwnStartingPoint(session: GameSession, bot: Player): Position | null {
        const start = session.getStartingPoint(bot.character.id);
        return start ?? null;
    }

    getFlagPosition(session: GameSession): Position | null {
        return session.getFlagPosition();
    }

    findNearestWalkableTile(session: GameSession, bot: Player, target: Position): Position | null {
        const queue: Position[] = [target];
        const visited = new Set<string>([this.pathfinding.positionKey(target)]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                break;
            }

            if (this.pathfinding.getMoveCost(session, current, bot) !== Infinity) {
                return current;
            }

            const neighbors = this.pathfinding.getNeighbors(current);
            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                const key = this.pathfinding.positionKey(neighbor);
                if (visited.has(key)) {
                    continue;
                }
                visited.add(key);
                queue.push(neighbor);
            }
        }

        return null;
    }

    findFleeTarget(session: GameSession, bot: Player, enemy: Player): Position | null {
        if (!bot.character.position || !enemy.character.position) {
            return null;
        }

        const reachable = this.pathfinding.dijkstra(session, bot);
        const enemyDists = this.pathfinding.dijkstra(session, enemy);

        let bestPosition: Position | null = bot.character.position;
        let bestDistance = enemyDists.get(this.pathfinding.positionKey(bot.character.position))?.cost ?? 0;

        const entries = Array.from(reachable.entries());
        for (let i = 0; i < entries.length; i++) {
            const [key, node] = entries[i];
            if (node.cost > (bot.character.remainingMovement ?? 0)) {
                continue;
            }

            const [x, y] = key.split(',').map(Number);
            const candidate = { x, y };
            const distanceFromEnemy = enemyDists.get(key)?.cost ?? 0;

            if (distanceFromEnemy > bestDistance) {
                bestDistance = distanceFromEnemy;
                bestPosition = candidate;
            }
        }

        return bestPosition;
    }

    getAdjacentEnemy(session: GameSession, bot: Player): Player | null {
        if (!bot.character.position) {
            return null;
        }

        return this.getEnemies(session, bot).find((enemy) => {
            if (!enemy.character.position) {
                return false;
            }

            const distance = Math.abs(enemy.character.position.x - bot.character.position.x)
                + Math.abs(enemy.character.position.y - bot.character.position.y);

            return distance === 1;
        }) ?? null;
    }

    private getEnemies(session: GameSession, bot: Player): Player[] {
        const botTeam = session.getPlayerTeam(bot.character.id);

        return session.players.filter((player) => {
            if (player.socketId === bot.socketId || !player.character.position) {
                return false;
            }

            if (session.gameMode !== 'ctf') {
                return true;
            }

            const playerTeam = session.getPlayerTeam(player.character.id);
            if (!botTeam || !playerTeam) {
                return true;
            }

            return botTeam !== playerTeam;
        });
    }
}
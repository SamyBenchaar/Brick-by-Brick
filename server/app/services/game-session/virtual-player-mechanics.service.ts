import { GameSession } from '@app/domain/game-session';
import { TILE_COST, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Inject, Injectable } from '@nestjs/common';
import { CombatService } from './combat.service';
import { MovementService } from './movement.service';

interface PathNode {
    cost: number;
    from: Position | null;
}

type MoveDirection = 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';

@Injectable()
export class VirtualPlayerMechanicsService {
    @Inject() private readonly combatService: CombatService;
    @Inject() private readonly movementService: MovementService;

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

    samePosition(a: Position, b: Position): boolean {
        return a.x === b.x && a.y === b.y;
    }

    findNearestEnemy(session: GameSession, bot: Player): Player | null {
        const enemies = this.getEnemies(session, bot);
        if (enemies.length === 0 || !bot.character.position) {
            return null;
        }

        const distFromBot = this.dijkstra(session, bot);

        let bestEnemy: Player | null = null;
        let bestCost = Infinity;

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.character.position) {
                continue;
            }

            const adjacentTiles = this.getNeighbors(enemy.character.position)
                .filter((position) => this.getMoveCost(session, position, bot) !== Infinity);

            let enemyBest = Infinity;
            for (let j = 0; j < adjacentTiles.length; j++) {
                const tile = adjacentTiles[j];
                const cost = distFromBot.get(this.positionKey(tile))?.cost ?? Infinity;
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

    findFleeTarget(session: GameSession, bot: Player, enemy: Player): Position | null {
        if (!bot.character.position || !enemy.character.position) {
            return null;
        }

        const reachable = this.dijkstra(session, bot);// Toutes les positions que le bot peut atteindre avec le mouvement restant, avec leur coût et la position précédente dans le chemin
        const enemyDists = this.dijkstra(session, enemy);// Toutes les positions que l'ennemi peut atteindre, avec leur coût et la position précédente dans le chemin

        let bestPosition: Position | null = bot.character.position;
        let bestDistance = enemyDists.get(this.positionKey(bot.character.position))?.cost ?? 0;

        const entries = Array.from(reachable.entries());// On parcourt toutes les positions atteignables par le bot
        for (let i = 0; i < entries.length; i++) {
            const [key, node] = entries[i];
            if (node.cost > (bot.character.remainingMovement ?? 0)) {// Si le coût pour atteindre cette position est supérieur au mouvement restant du bot, on l'ignore
                continue;
            }

            const [x, y] = key.split(',').map(Number);
            const candidate = { x, y };
            const distanceFromEnemy = enemyDists.get(key)?.cost ?? 0;

            if (distanceFromEnemy > bestDistance) {
                bestDistance = distanceFromEnemy;
                bestPosition = candidate;// Si cette position est plus éloignée de l'ennemi que la meilleure trouvée jusqu'à présent, on la choisit comme nouvelle meilleure position
            }
        }

        return bestPosition;
    }

    async moveTowardEnemy(session: GameSession, bot: Player, enemy: Player): Promise<boolean> {
        const candidates = this.getNeighbors(enemy.character.position)
            .filter((position) => this.getMoveCost(session, position, bot) !== Infinity)
            .filter((position) => !this.samePosition(position, bot.character.position));

        if (candidates.length === 0) {
            return false;
        }

        let bestTarget: Position | null = null;
        let bestCost = Infinity;

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            const pathInfo = this.buildShortestPath(session, bot, candidate);
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
        const pathInfo = this.buildShortestPath(session, bot, target);
        if (!pathInfo || pathInfo.path.length === 0) {
            return false;
        }

        let moved = false;
        for (let i = 0; i < pathInfo.path.length; i++) {
            const next = pathInfo.path[i];
            if (!this.canMove(bot) || !bot.character.position) {
                break;
            }

            const direction = this.getDirection(bot.character.position, next);
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
                break;
            }

            moved = true;
        }

        return moved;
    }

    async tryAttackAdjacent(session: GameSession, bot: Player): Promise<boolean> {
        if (!this.hasAction(bot)) {
            return false;
        }

        const target = this.getAdjacentEnemy(session, bot);
        if (!target) {
            return false;
        }

        const mapCopy = session.getMapCopy();
        if (!mapCopy) {
            return false;
        }

        await this.randomDelay();
        this.combatService.executeCombat(
            session,
            bot.character,
            target.character,
            mapCopy,
        );
        return true;
    }

    private buildShortestPath(session: GameSession, bot: Player, target: Position): { path: Position[]; totalCost: number } | null {
        if (!bot.character.position) {
            return null;
        }

        const dist = this.dijkstra(session, bot);
        const targetKey = this.positionKey(target);// "x,y"
        const targetNode = dist.get(targetKey);// PathNode associé à la position cible, contenant le coût total et la position précédente dans le chemin
        if (!targetNode) {
            return null;
        }

        const path: Position[] = [];
        let current: Position | null = target;

        while (current && !this.samePosition(current, bot.character.position)) {
            path.unshift(current);
            const node = dist.get(this.positionKey(current));
            current = node?.from ?? null;
        }

        if (path.length === 0 && !this.samePosition(target, bot.character.position)) {
            return null;
        }

        return { path, totalCost: targetNode.cost };
    }

    private dijkstra(session: GameSession, bot: Player): Map<string, PathNode> {
        const origin = bot.character.position;
        const dist = new Map<string, PathNode>();

        if (!origin) {
            return dist;
        }

        const queue: { pos: Position; cost: number }[] = [{ pos: origin, cost: 0 }];
        const visited = new Set<string>();// une position x,y va devenir un string "x,y" pour être stocké dans ce set et dans la map dist
        dist.set(this.positionKey(origin), { cost: 0, from: null });

        while (queue.length > 0) {
            queue.sort((a, b) => a.cost - b.cost);
            const current = queue.shift();
            if (!current) {
                break;
            }

            const key = this.positionKey(current.pos);
            if (visited.has(key)) {
                continue;
            }
            visited.add(key);

            const neighbors = this.getNeighbors(current.pos);
            for (let i = 0; i < neighbors.length; i++) {
                const neighbor = neighbors[i];
                const stepCost = this.getMoveCost(session, neighbor, bot);
                if (stepCost === Infinity) {
                    continue;
                }

                const newCost = current.cost + stepCost;
                const neighborKey = this.positionKey(neighbor);
                const known = dist.get(neighborKey);

                if (!known || newCost < known.cost) {
                    dist.set(neighborKey, { cost: newCost, from: current.pos });
                    queue.push({ pos: neighbor, cost: newCost });
                }
            }
        }

        return dist;
    }

    private getAdjacentEnemy(session: GameSession, bot: Player): Player | null {
        if (!bot.character.position) {
            return null;
        }

        return this.getEnemies(session, bot).find((enemy) => {// On cherche un ennemi adjacent (distance de 1) parmi les ennemis du bot
            if (!enemy.character.position) {
                return false;
            }

            const distance = Math.abs(enemy.character.position.x - bot.character.position.x)
                + Math.abs(enemy.character.position.y - bot.character.position.y);

            return distance === 1;
        }) ?? null;
    }

    private getEnemies(session: GameSession, bot: Player): Player[] {
        return session.players.filter((player) => player.socketId !== bot.socketId && !!player.character.position);
    }

    private getMoveCost(session: GameSession, to: Position, bot: Player): number {
        const mapData = session.getMapCopy()?.tiles;
        if (!mapData || to.y < 0 || to.y >= mapData.length || to.x < 0 || to.x >= mapData[0].length) {// Si la position cible est hors des limites de la carte, on considère que le coût est infini (impossible à atteindre)
            return Infinity;
        }

        const tile = mapData[to.y][to.x];
        if (tile.type === TileType.Wall || tile.type === TileType.Door) {
            return Infinity;
        }

        const occupied = session.players.some((player) => {// On vérifie si la position cible est occupée par un joueur (autre que le bot lui-même) 
            const playerPos = player.character.position;
            if (!playerPos) {
                return false;
            }

            const isBot = player.socketId === bot.socketId;
            return !isBot && playerPos.x === to.x && playerPos.y === to.y;
        });

        if (occupied) {
            return Infinity;
        }

        return TILE_COST[tile.type as TileType] ?? 1;
    }

    private getNeighbors(position: Position): Position[] {
        return [
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
        ];
    }

    private getDirection(from: Position, to: Position): MoveDirection | null {
        if (to.x === from.x && to.y === from.y - 1) {
            return 'arrowUp';
        }
        if (to.x === from.x && to.y === from.y + 1) {
            return 'arrowDown';
        }
        if (to.x === from.x - 1 && to.y === from.y) {
            return 'arrowLeft';
        }
        if (to.x === from.x + 1 && to.y === from.y) {
            return 'arrowRight';
        }

        return null;
    }

    private positionKey(position: Position): string {
        return `${position.x},${position.y}`;
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * this.actionDelayRangeMs) + this.minActionDelayMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}
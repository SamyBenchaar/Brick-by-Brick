import { GameSession } from '@app/domain/game-session';
import { TILE_COST, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Injectable } from '@nestjs/common';

export interface PathNode {
    cost: number;
    from: Position | null;
}

export type MoveDirection = 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight';

@Injectable()
export class VirtualPlayerPathfindingService {
    samePosition(a: Position, b: Position): boolean {
        return a.x === b.x && a.y === b.y;
    }

    getNeighbors(position: Position): Position[] {
        return [
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
        ];
    }

    getDirection(from: Position, to: Position): MoveDirection | null {
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

    positionKey(position: Position): string {
        return `${position.x},${position.y}`;
    }

    getMoveCost(session: GameSession, to: Position, bot: Player): number {
        const mapData = session.getMapCopy()?.tiles;
        if (!mapData || to.y < 0 || to.y >= mapData.length || to.x < 0 || to.x >= mapData[0].length) {
            return Infinity;
        }

        const tile = mapData[to.y][to.x];
        if (tile.type === TileType.Wall) {
            return Infinity;
        }

        const occupied = session.players.some((player) => {
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

    dijkstra(session: GameSession, bot: Player): Map<string, PathNode> {
        const origin = bot.character.position;
        const dist = new Map<string, PathNode>();

        if (!origin) {
            return dist;
        }

        const queue: { pos: Position; cost: number }[] = [{ pos: origin, cost: 0 }];
        const visited = new Set<string>();
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

    buildShortestPath(session: GameSession, bot: Player, target: Position): { path: Position[]; totalCost: number } | null {
        if (!bot.character.position) {
            return null;
        }

        const dist = this.dijkstra(session, bot);
        const targetNode = dist.get(this.positionKey(target));
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
}
import { GameSession, Position } from '@app/domain/game-session';
import { MapTile } from '@app/interfaces/game-map-interfaces';
import { Direction } from '@app/interfaces/map-validation-interfaces';
import { Character } from '@common/character';
import { KEY_DIRECTION_MAP } from '@common/constants/key-event.constants';
import { DoorState, ObjectType, TILE_COST, TileType } from '@common/map';
import { Injectable } from '@nestjs/common';

type NeighborsProcessingContext = {
    queue: { pos: Position; cost: number }[];
    bestCosts: Map<string, number>;
    reachable: Set<string>;
    movementPoints: number;
    mapData: MapTile[][];
    occupiedPositions: Set<string>;
};

@Injectable()
export class MovementService {
    private readonly directions: Record<string, Direction> = {
        arrowUp: { dx: 0, dy: -1 },
        arrowDown: { dx: 0, dy: 1 },
        arrowLeft: { dx: -1, dy: 0 },
        arrowRight: { dx: 1, dy: 0 },
    };

    private toPositionKey(position: Position): string {
        return `${position.x},${position.y}`;
    }

    private getTileCost(tileType: string): number {
        return TILE_COST[tileType] ?? 0;
    }

    private isValidTile(mapData: MapTile[][], position: Position, occupiedPositions: Set<string>): boolean {
        if (position.y < 0 || position.y >= mapData.length ||
            position.x < 0 || position.x >= mapData[0].length) {
            return false;
        }

        const tile = mapData[position.y][position.x];

        if (tile.type === TileType.Wall) {
            return false;
        }
        if (tile.type === TileType.Door && tile.doorState !== DoorState.Opened) return false;
        if (tile.object?.type === ObjectType.HealingSanctuary || tile.object?.type === ObjectType.CombatSanctuary) return false;


        const posKey = `${position.x},${position.y}`;
        if (occupiedPositions.has(posKey)) {
            return false;
        }

        return [TileType.Base, TileType.Water, TileType.Ice].includes(tile.type as TileType) ||
            (tile.type === TileType.Door && tile.doorState === DoorState.Opened);
    }

    getReachableTiles(
        gameSession: GameSession,
        currentPosition: Position,
        movementPoints: number,
        mapData: MapTile[][],
    ): Position[] {
        const reachable = new Set<string>();
        const bestCosts = new Map<string, number>();
        const occupiedPositions = this.getOccupiedPositions(gameSession);
        occupiedPositions.delete(this.toPositionKey(currentPosition));

        const startKey = this.toPositionKey(currentPosition);
        reachable.add(startKey);
        bestCosts.set(startKey, 0);

        const queue: { pos: Position; cost: number }[] = [{ pos: currentPosition, cost: 0 }];

        while (queue.length > 0) {
            const current = this.extractLowestCostNode(queue);
            this.processNeighbors(current, {
                queue,
                bestCosts,
                reachable,
                movementPoints,
                mapData,
                occupiedPositions,
            });
        }

        return this.toPositions(reachable);
    }

    private extractLowestCostNode(queue: { pos: Position; cost: number }[]): { pos: Position; cost: number } {
        let currentIndex = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i].cost < queue[currentIndex].cost) {
                currentIndex = i;
            }
        }

        const [current] = queue.splice(currentIndex, 1);
        return current;
    }

    private processNeighbors(
        current: { pos: Position; cost: number },
        context: NeighborsProcessingContext,
    ): void {
        const { queue, bestCosts, reachable, movementPoints, mapData, occupiedPositions } = context;
        const { pos, cost } = current;

        for (const direction of Object.values(this.directions)) {
            const newPos: Position = {
                x: pos.x + direction.dx,
                y: pos.y + direction.dy,
            };

            if (!this.isValidTile(mapData, newPos, occupiedPositions)) {
                continue;
            }

            const newPosKey = this.toPositionKey(newPos);
            const tileType = mapData[newPos.y][newPos.x].type;
            const moveCost = this.getTileCost(tileType);
            const totalCost = cost + moveCost;

            if (totalCost > movementPoints) {
                continue;
            }

            const existingCost = bestCosts.get(newPosKey);
            if (existingCost !== undefined && totalCost >= existingCost) {
                continue;
            }

            bestCosts.set(newPosKey, totalCost);
            reachable.add(newPosKey);
            queue.push({ pos: newPos, cost: totalCost });
        }
    }

    private toPositions(reachable: Set<string>): Position[] {
        return Array.from(reachable).map((key) => {
            const [x, y] = key.split(',');
            return { x: parseInt(x, 10), y: parseInt(y, 10) };
        });
    }

    private getOccupiedPositions(gameSession: GameSession): Set<string> {
        const occupied = new Set<string>();

        for (const player of gameSession.players) {
            const posKey = this.toPositionKey(player.character.position);
            occupied.add(posKey);
        }

        return occupied;
    }

    executeMove(
        gameSession: GameSession,
        player: Character,
        direction: keyof typeof KEY_DIRECTION_MAP,
        mapData: MapTile[][],
    ): boolean {
        const directionDelta = this.directions[direction];
        if (!directionDelta) {
            return false;
        }

        if (player.remainingMovement === undefined) {
            return false;
        }

        const newPos: Position = {
            x: player.position.x + directionDelta.dx,
            y: player.position.y + directionDelta.dy,
        };

        const occupiedPositions = this.getOccupiedPositions(gameSession);
        occupiedPositions.delete(`${player.position.x},${player.position.y}`);
        if (!this.isValidTile(mapData, newPos, occupiedPositions)) {
            return false;
        }

        const tile = mapData[newPos.y][newPos.x];
        const moveCost = this.getTileCost(tile.type);

        if (moveCost > player.remainingMovement) {
            return false;
        }

        player.position = newPos;
        if (gameSession.isTileVisited(player.id, newPos)) {
            player.tilesVisited++;
        }
        player.remainingMovement -= moveCost;

        return true;
    }

    assignPosition(player: Character, gameSession: GameSession, newPosition: Position): void {
        if (!player) {
            return;
        }

        const tile = gameSession.getMapCopy()?.tiles?.[newPosition.y]?.[newPosition.x];
        if (!tile) {
            return;
        }

        const occupied = gameSession.players.some(
            (p) =>
                p.character.id !== player.id &&
                p.character.position?.x === newPosition.x &&
                p.character.position?.y === newPosition.y,
        );

        const isWallOrClosedDoor = tile.type === TileType.Wall || (tile.type === TileType.Door && tile.doorState !== DoorState.Opened);
        const hasObstacle = occupied || !!tile.object;

        if (isWallOrClosedDoor || hasObstacle) {
            return;
        }

        player.position = newPosition;
    }

    resetMovementPoints(player: Character): void {
        player.remainingMovement = player.speed;
        player.remainingActions = 1;
    }

    isAdjacentToPlayer(
        position: Position,
        otherPlayer: Character,
    ): boolean {
        const distance = Math.abs(position.x - otherPlayer.position.x) +
            Math.abs(position.y - otherPlayer.position.y);
        return distance === 1;
    }


    getAdjacentPlayers(
        gameSession: GameSession,
        position: Position,
    ): Character[] {
        return gameSession.getCharacters().filter(player =>
            (player.position.x !== position.x || player.position.y !== position.y) &&
            this.isAdjacentToPlayer(position, player),
        );
    }

    isDoorAdjacent(position: Position, gameSession: GameSession): boolean {
        const adjacentPositions = [
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
        ];
        return adjacentPositions.some(pos => gameSession.getMapCopy()?.tiles?.[pos.y]?.[pos.x]?.type === TileType.Door);
    }

    isSanctuaryAdjacent(position: Position, gameSession: GameSession): Position| null {
        const adjacentPositions = [
            { x: position.x - 1, y: position.y },
            { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y - 1 },
            { x: position.x, y: position.y + 1 },
        ];
        return adjacentPositions.find(pos => {
            const tile = gameSession.getMapCopy()?.tiles?.[pos.y]?.[pos.x];
            return tile?.object?.type === ObjectType.CombatSanctuary || tile?.object?.type === ObjectType.HealingSanctuary;
        }) || null;
     }
}
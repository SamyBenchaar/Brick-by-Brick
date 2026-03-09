import { Character } from '@common/character';
import { GameSession, Position } from '@common/gameSession';
import { TileType } from '@common/map';
import { Injectable, Logger } from '@nestjs/common';

interface MovementCost {
    base: number;
    water: number;
    ice: number;
}

interface MapTile {
    type: string;
    object?: { type: string };
}

@Injectable()
export class MovementService {
    private logger = new Logger(MovementService.name);
    private readonly cost: MovementCost = {
        base: 1,
        water: 2,
        ice: 0,
    };

    private readonly directions = {
        arrowUp: { x: 0, y: -1 },    // Up
        arrowDown: { x: 0, y: 1 },   // Down
        arrowLeft: { x: -1, y: 0 },  // Left
        arrowRight: { x: 1, y: 0 },  // Right
    };

    private getTileCost(tileType: string): number {
        switch (tileType) {
            case TileType.Base:
                return this.cost.base;
            case TileType.Water:
                return this.cost.water;
            case TileType.Ice:
                return this.cost.ice;
            default:
                return Infinity; // Impassable
        }
    }

    private isValidTile(mapData: MapTile[][], position: Position, occupiedPositions: Set<string>): boolean {
        // Check bounds
        if (position.y < 0 || position.y >= mapData.length ||
            position.x < 0 || position.x >= mapData[0].length) {
            return false;
        }

        const tile = mapData[position.y][position.x];

        if (tile.type === TileType.Wall || tile.type === TileType.Door) {
            return false;
        }

        const posKey = `${position.x},${position.y}`;
        if (occupiedPositions.has(posKey)) {
            return false;
        }

        return [TileType.Base, TileType.Water, TileType.Ice].includes(tile.type as TileType);
    }

    getReachableTiles(
        gameSession: GameSession,
        currentPosition: Position,
        movementPoints: number,
        mapData: MapTile[][],
    ): Position[] {
        const reachable = new Set<string>();
        const visited = new Set<string>();
        const occupiedPositions = this.getOccupiedPositions(gameSession);
        occupiedPositions.delete(`${currentPosition.x},${currentPosition.y}`); // Exclude current position

        // BFS 
        const queue: { pos: Position; cost: number }[] = [
            { pos: currentPosition, cost: 0 },
        ];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            const { pos, cost } = current;
            const posKey = `${pos.x},${pos.y}`;

            if (visited.has(posKey)) {
                continue;
            }
            visited.add(posKey);

            for (const direction of Object.values(this.directions)) {
                const newPos: Position = {
                    x: pos.x + direction.x,
                    y: pos.y + direction.y,
                };

                if (!this.isValidTile(mapData, newPos, occupiedPositions)) {
                    continue;
                }

                const tileType = mapData[newPos.y][newPos.x].type;
                const moveCost = this.getTileCost(tileType);
                const totalCost = cost + moveCost;

                if (totalCost <= movementPoints) {
                    const newPosKey = `${newPos.x},${newPos.y}`;
                    reachable.add(newPosKey);

                    // Continuation BFS
                    queue.push({ pos: newPos, cost: totalCost });
                }
            }
        }

        return Array.from(reachable).map(key => {
            const [x, y] = key.split(',');
            return { x: parseInt(x, 10), y: parseInt(y, 10) };
        });
    }

    private getOccupiedPositions(gameSession: GameSession): Set<string> {
        const occupied = new Set<string>();

        for (const player of gameSession.players) {
            const posKey = `${player.character.position.x},${player.character.position.y}`;
            occupied.add(posKey);
        }

        return occupied;
    }

    executeMove(
        gameSession: GameSession,
        player: Character,
        direction: 'arrowUp' | 'arrowDown' | 'arrowLeft' | 'arrowRight',
        mapData: MapTile[][],
    ): boolean {
        const directionDelta = this.directions[direction];
        if (!directionDelta) {
            return false;
        }

        const newPos: Position = {
            x: player.position.x + directionDelta.x,
            y: player.position.y + directionDelta.y,
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

        player.moveTo(newPos);
        player.remainingMovement -= moveCost;

        return true;
    }

    resetMovementPoints(player: Character): void {
        player.resetMovement();
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
}



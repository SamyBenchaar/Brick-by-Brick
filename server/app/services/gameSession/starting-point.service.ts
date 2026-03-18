import { GameSession } from '@app/domain/game-session';
import { Position } from '@common/position';
import { Injectable } from '@nestjs/common';
import { MapTile, GameMap } from '@app/interfaces/game-map-interfaces';
import { ObjectType, TileType } from '@common/map';

@Injectable()
export class StartingPointService {

    assignStartingPoints(gameSession: GameSession, mapConfig: GameMap): void {
        const mapData = mapConfig.tiles;
        const validStartingPoints = this.getValidStartingPoints(mapData);

        if (validStartingPoints.length === 0) {
            throw new Error('No valid starting points found on the map');
        }

        const players = gameSession.getActivePlayers();
        const selectedStartingPoints: Position[] = [];

        for (const player of players) {
            let position: Position;
            let isValid = false;

            while (!isValid) {
                position = validStartingPoints[Math.floor(Math.random() * validStartingPoints.length)];
                isValid = !selectedStartingPoints.some(p => p.x === position.x && p.y === position.y);
            }

            gameSession.setStartingPoint(player.id, position);
            selectedStartingPoints.push(position);
            player.startPosition = position;
            player.position = position;
            player.remainingMovement = player.speed;
            player.remainingActions = 1;
            player.victories = 0;
        }
    }

    private getValidStartingPoints(mapData: MapTile[][]): Position[] {
        const startingPoints: Position[] = [];

        for (let y = 0; y < mapData.length; y++) {
            for (let x = 0; x < mapData[y].length; x++) {
                const tile = mapData[y][x];

                if (tile.object && tile.object.type === ObjectType.StartingPoint) {
                    startingPoints.push({ x, y });
                }
            }
        }

        return startingPoints;
    }

    getAfterCombatPosition(
        startingPoint: Position,
        mapConfig: GameMap,
        occupiedPositions: Position[],
    ): Position {
        const occupied = new Set(occupiedPositions.map((p) => `${p.x},${p.y}`));
        let closestPoint: Position | null = null;
        let minDistance = Infinity;

        for (let y = 0; y < mapConfig.tiles.length; y++) {
            for (let x = 0; x < mapConfig.tiles[y].length; x++) {
                const tile = mapConfig.tiles[y][x];
                const posKey = `${x},${y}`;

                if (occupied.has(posKey)) {
                    continue;
                }

                if (tile.type === TileType.Wall || tile.type === TileType.Door) {
                    continue;
                }

                if (tile.object && tile.object.type !== ObjectType.StartingPoint) {
                    continue;
                }

                const candidate = { x, y };
                const distance = this.calculateDistance(startingPoint, candidate);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestPoint = candidate;
                }
            }
        }

        return closestPoint ?? startingPoint;
    }

    private calculateDistance(pos1: Position, pos2: Position): number {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }

    cleanupUnusedStartingPoints(gameSession: GameSession, mapData: MapTile[][]): void {
        const activePlayerPositions = new Set<string>();
        const startingPoints = gameSession.startingPoints;

        startingPoints.forEach((position) => {
            activePlayerPositions.add(`${position.x},${position.y}`);
        });

        for (let y = 0; y < mapData.length; y++) {
            for (let x = 0; x < mapData[y].length; x++) {
                const tile = mapData[y][x];
                const posKey = `${x},${y}`;

                if (
                    tile.object &&
                    tile.object.type === TileType.Wall &&
                    !activePlayerPositions.has(posKey)
                ) {
                    tile.object = undefined;
                }
            }
        }
    }
}

import { GameSession } from '@app/domain/game-session';
import { Position } from '@common/character';
import { Injectable } from '@nestjs/common';

interface MapTile {
    type: string;
    object?: { type: string };
}

interface GameMap {
    tiles: MapTile[][];
}

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

                if (tile.object && tile.object.type === 'startingpoint') {
                    startingPoints.push({ x, y });
                }
            }
        }

        return startingPoints;
    }

    getClosestAvailableStartingPoint(
        targetPosition: Position,
        mapConfig: GameMap,
        occupiedPositions: Position[],
    ): Position {
        const validStartingPoints = this.getValidStartingPoints(mapConfig.tiles);

        const availablePoints = validStartingPoints.filter(
            point => !occupiedPositions.some(p => p.x === point.x && p.y === point.y),
        );

        if (availablePoints.length === 0) {
            return validStartingPoints[0];
        }

        let closestPoint = availablePoints[0];
        let minDistance = this.calculateDistance(targetPosition, closestPoint);

        for (const point of availablePoints) {
            const distance = this.calculateDistance(targetPosition, point);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }

        return closestPoint;
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
                    tile.object.type === 'startingpoint' &&
                    !activePlayerPositions.has(posKey)
                ) {
                    tile.object = undefined;
                }
            }
        }
    }
}

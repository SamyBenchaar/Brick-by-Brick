import { GameSession } from '@app/domain/game-session';
import { TileDto } from '@app/dto/tile.dto';
import { Position } from '@common/position';

export function findNearestFreeTilePosition(gameSession: GameSession, fromPosition: Position): Position | null {
    if (!gameSession.mapCopy) {
        return null;
    }

    const mapData = gameSession.mapCopy.tiles;
    const height = mapData.length;
    const width = mapData[0].length;

    const queue: Position[] = [fromPosition];
    const visited = new Set<string>();
    visited.add(`${fromPosition.x},${fromPosition.y}`);

    const directions = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
        const position = queue.shift();
        if (!position) {
            break;
        }

        if (isFreeTile(gameSession, position, mapData)) {
            return position;
        }

        for (const direction of directions) {
            const nextPosition = { x: position.x + direction.x, y: position.y + direction.y };
            const key = `${nextPosition.x},${nextPosition.y}`;

            const inBoundsX = nextPosition.x >= 0 && nextPosition.x < width;
            const inBoundsY = nextPosition.y >= 0 && nextPosition.y < height;

            if (!visited.has(key) && inBoundsX && inBoundsY) {
                visited.add(key);
                queue.push(nextPosition);
            }
        }
    }

    return null;
}

function isFreeTile(gameSession: GameSession, position: Position, mapData: TileDto[][]): boolean {
    const tile = mapData[position.y][position.x];

    if (tile.type === 'wall' || tile.object) {
        return false;
    }

    if (tile.type === 'door' && tile.doorState === 'opened') {
        return false;
    }

    const hasPlayer = gameSession.players.some(
        player => player.character.position?.x === position.x && player.character.position?.y === position.y,
    );

    return !hasPlayer;
}

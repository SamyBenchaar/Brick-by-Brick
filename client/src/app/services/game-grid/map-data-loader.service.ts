import { Injectable, inject } from '@angular/core';
import { GameMap } from '@app/classes/game-map/game-map';
import { GameSize } from '@app/constants/game-size.enum';
import { Game } from '@app/interfaces/game';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { DoorState, MapSize, ObjectType, TileType } from '@common/map';

@Injectable({
    providedIn: 'root',
})
export class MapDataLoaderService {
    private objectCounterService = inject(ObjectCounterService);

    loadGameData(gameData: Game): GameMap {
        const size = gameData.mapConfig.size;
        let mapSize = MapSize.Small;
        if (size === GameSize.MEDIUM) mapSize = MapSize.Medium;
        else if (size === GameSize.LARGE) mapSize = MapSize.Large;

        const gameMap = new GameMap(mapSize);
        const tiles = gameData.mapConfig.tiles;

        if (tiles) {
            for (let y = 0; y < tiles.length; y++) {
                for (let x = 0; x < tiles[y].length; x++) {
                    const position = { x, y };
                    const tileData = tiles[position.y][position.x];
                    const tile = gameMap.getTile(position);

                    if (!tile) continue;

                    tile.type = tileData.type as TileType;
                    tile.doorState = undefined;
                    if (tileData.type === TileType.Door) {
                        tile.doorState = (tileData.doorState as DoorState) ?? DoorState.Closed;
                    }
                    if (tileData.object) {
                        tile.object = tileData.object.type as ObjectType;
                        this.objectCounterService.place(tile.object);
                    }
                }
            }
        }

        return gameMap;
    }
}

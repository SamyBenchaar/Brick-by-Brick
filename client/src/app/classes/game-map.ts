import { Tile } from '@app/classes/tile';
import { Position } from '@common/position';
import { MapSize, TileType } from '@common/map';

export class GameMap {

    readonly size: MapSize;
    readonly grid: Tile[][];
    constructor(size: MapSize = MapSize.Small) {
        this.size = size;
        this.grid = this.initGrid();
    }
    private initGrid(): Tile[][] {
        const grid: Tile[][] = [];
        for (let y = 0; y < this.size; y++) {
            grid[y] = [];
            for (let x = 0; x < this.size; x++) {
                grid[y][x] = new Tile(TileType.Base);
                grid[y][x].object = undefined;
            }
        }

        return grid;
    }

    getTile(position: Position): Tile | null {
        if (position.x >= 0 && position.x < this.size && position.y >= 0 && position.y < this.size) {
            return this.grid[position.y][position.x];
        }
        return null;
    }
}

import { Tile } from '@app/classes/tile';
import { MAP_SIZE_DIMENSIONS, MapSize, TileType } from '@common/map';

export class GameMap {

    private _size: MapSize;
    private _grid: Tile[][];
    constructor(size: MapSize = MapSize.Small) {
        this._size = size;
        this._grid = this.initGrid();
    }
    private initGrid(): Tile[][] {
        const dimension = MAP_SIZE_DIMENSIONS[this._size];
        const grid: Tile[][] = [];
        for (let y = 0; y < dimension; y++) {
            grid[y] = [];
            for (let x = 0; x < dimension; x++) {
                grid[y][x] = new Tile(TileType.Base, x, y);
                grid[y][x].object = undefined;
            }
        }

        return grid;
    }
    getGrid(): Tile[][] {
        return this._grid;
    }
    getSize(): number {
        return MAP_SIZE_DIMENSIONS[this._size];
    }

    getTile(x: number, y: number): Tile | null {
        const dimension = MAP_SIZE_DIMENSIONS[this._size];
        if (x >= 0 && x < dimension && y >= 0 && y < dimension) {
            return this._grid[y][x];
        }
        return null;
    }
}

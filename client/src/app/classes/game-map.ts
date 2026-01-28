import { Tile } from '@app/classes/tile';
import { MapSize, TileType } from '@common/map';

export class GameMap {

    private _size: MapSize;
    private _grid: Tile[][];
    constructor(size: MapSize = MapSize.Small) {
        this._size = size;
        this._grid = this.initGrid();
    }
    private initGrid(): Tile[][] {
        const grid: Tile[][] = [];
        for (let y = 0; y < this._size; y++) {
            grid[y] = [];
            for (let x = 0; x < this._size; x++) {
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
        return this._size;
    }

    getTile(x: number, y: number): Tile | null {
        if (x >= 0 && x < this._size && y >= 0 && y < this._size) {
            return this._grid[y][x];
        }
        return null;
    }
}

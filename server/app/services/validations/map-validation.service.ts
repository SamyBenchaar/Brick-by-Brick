import { SANCTUARY_ADJACENT_POSITIONS } from '@app/constants/sanctuary-validation-constants';
import { Direction, GridPosition } from '@app/interfaces/map-validation-interfaces';
import { Game } from '@app/model/game';
import { Tile } from '@app/model/tile';
import { GameModeValue } from '@common/constants/game-config-constants';
import { MapSize, MIN_TERRAIN_COVERAGE, ObjectType, PERCENTAGE_MULTIPLIER, PLAYABLE_TYPES, TileType } from '@common/map';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MapValidationService {
    private readonly cardinalDirections: Direction[] = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
    ];

    async validateMap(gameData: Partial<Game>): Promise<string[]> {
        const errors: string[] = [];

        // Validation: Plus de 50% de la surface doit être du terrain jouable
        errors.push(...this.validateTerrainCoverage(gameData));

        // Validation: Tous les points de départ ont été placés
        errors.push(...this.validateStartingPoints(gameData));

        // Validation: Toutes les tuiles de terrain doivent être accessibles
        errors.push(...this.validateTerrainAccessibility(gameData));

        // Validation: Toutes les portes doivent être placées sur les bords de la carte
        errors.push(...this.validateDoors(gameData));

        // Validation: Tous les sanctuaires doivent être accessibles
        errors.push(...this.validateSanctuaries(gameData));

        // Validation: Le drapeau doit être placé en mode CTF
        errors.push(...this.validateFlagForCTF(gameData));

        return errors;
    }

    private validateTerrainCoverage(gameData: Partial<Game>): string[] {
        const gridSize = MapSize[gameData.mapConfig.size as keyof typeof MapSize];
        const totalSurface = gridSize * gridSize;
        const playableTileCount = this.countPlayableTiles(gameData);

        const coverage = playableTileCount / totalSurface;

        if (coverage <= MIN_TERRAIN_COVERAGE) {
            return [
                `La surface de terrain jouable est insuffisante: ${(coverage * PERCENTAGE_MULTIPLIER).toFixed(1)}%. ` +
                `Au moins 50% de la surface doit être du terrain jouable.`,
            ];
        }
        return [];
    }

    private validateStartingPoints(gameData: Partial<Game>): string[] {
        let numberOfStartingPoints = 0;
        for (const row of gameData.mapConfig.tiles) {
            for (const tile of row) {
                if (tile.object?.type === ObjectType.StartingPoint) {
                    numberOfStartingPoints++;
                }
            }
        }

        if (numberOfStartingPoints !== gameData.numberOfPlayers) {
            return [
                `Le nombre de points de départ (${numberOfStartingPoints}) doit être égal au nombre de joueurs (${gameData.numberOfPlayers})`,
            ];
        }
        return [];
    }

    private validateTerrainAccessibility(gameData: Partial<Game>): string[] {
        const tiles = gameData.mapConfig.tiles;
        const gridSize = MapSize[gameData.mapConfig.size as keyof typeof MapSize];
        const totalPlayableTiles = this.countPlayableTiles(gameData);

        const startPoint = this.findStartingPoint(tiles);
        if (!startPoint) {
            return ['Aucun point de départ trouvé pour vérifier l\'accessibilité'];
        }

        const accessibleTiles = this.countAccessibleTilesFromStart(tiles, gridSize, startPoint);

        if (accessibleTiles !== totalPlayableTiles) {
            return [
                `Certaines tuiles de terrain sont inaccessibles. ` +
                `Tuiles accessibles: ${accessibleTiles}/${totalPlayableTiles}`,
            ];
        }
        return [];
    }

    private countAccessibleTilesFromStart(tiles: Tile[][], gridSize: number, startPoint: GridPosition): number {
        const visited = this.createVisitedGrid(gridSize);
        const queue: GridPosition[] = [startPoint];
        visited[startPoint.y][startPoint.x] = true;

        let accessibleTiles = 1;

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }

            for (const neighbor of this.getValidNeighbors(current, gridSize, visited, tiles)) {
                visited[neighbor.y][neighbor.x] = true;
                queue.push(neighbor);
                accessibleTiles++;
            }
        }

        return accessibleTiles;
    }

    private createVisitedGrid(gridSize: number): boolean[][] {
        return Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    }

    private getValidNeighbors(current: GridPosition, gridSize: number, visited: boolean[][], tiles: Tile[][]): GridPosition[] {
        const neighbors: GridPosition[] = [];

        for (const direction of this.cardinalDirections) {
            const neighbor: GridPosition = { x: current.x + direction.dx, y: current.y + direction.dy };

            if (!this.isWithinBounds(neighbor, gridSize) || visited[neighbor.y][neighbor.x]) {
                continue;
            }

            if (this.isAccessibleTile(tiles[neighbor.y][neighbor.x])) {
                neighbors.push(neighbor);
            }
        }

        return neighbors;
    }

    private isWithinBounds(position: GridPosition, gridSize: number): boolean {
        const isXValid = position.x >= 0 && position.x < gridSize;
        const isYValid = position.y >= 0 && position.y < gridSize;
        return isXValid && isYValid;
    }

    private isAccessibleTile(tile: Tile): boolean {
        const objectType = tile.object?.type;
        return PLAYABLE_TYPES.includes(tile.type as TileType)
            && objectType !== ObjectType.HealingSanctuary
            && objectType !== ObjectType.CombatSanctuary;
    }

    private validateSanctuaries(gameData: Partial<Game>): string[] {
        const tiles = gameData.mapConfig.tiles;
        if (!this.isSanctuaryAccessible(tiles)) {
            return [`certains sanctuaires sont inaccessibles.`];
        }
        return [];
    }

    private validateDoors(gameData: Partial<Game>): string[] {
        const tiles = gameData.mapConfig.tiles;
        if (!this.checkMapEdge(tiles)) {
            return [`Les portes ne peuvent pas être placées sur les bords de la carte.`];
        }
        if (!this.checkDoorNeighbors(tiles)) {
            return [`Les portes doivent etre places entre des murs du meme axe et des tuiles de terrains du meme axe.`];
        }
        return [];
    }

    private countPlayableTiles(gameData: Partial<Game>): number {
        const tiles = gameData.mapConfig.tiles;
        let count = 0;

        for (const row of tiles) {
            for (const tile of row) {
                const objectType = tile.object?.type;
                if (PLAYABLE_TYPES.includes(tile.type as TileType)
                    && objectType !== ObjectType.HealingSanctuary && objectType !== ObjectType.CombatSanctuary
                ) {
                    count++;
                }
            }
        }

        return count;
    }

    private findStartingPoint(tiles: Tile[][]): GridPosition | null {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                if (tiles[y][x].object?.type === ObjectType.StartingPoint) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    private checkMapEdge(tiles: Tile[][]): boolean {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                const tile = tiles[y][x];
                if (tile.type === TileType.Door) {
                    const isXEdge = x === 0 || x === tiles[y].length - 1;
                    const isYEdge = y === 0 || y === tiles.length - 1;
                    if (isXEdge || isYEdge) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private isSanctuaryAccessible(tiles: Tile[][]): boolean {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                const tile = tiles[y][x];
                if ((tile.object?.type === ObjectType.HealingSanctuary || tile.object?.type === ObjectType.CombatSanctuary) && tile.isOrigin) {
                    const checkPos = SANCTUARY_ADJACENT_POSITIONS.map(({ dx, dy }) => ({ x: x + dx, y: y + dy }));

                    const hasAccess = checkPos.some(pos =>
                        pos.x >= 0 && pos.x < tiles[y].length &&
                        pos.y >= 0 && pos.y < tiles.length &&
                        PLAYABLE_TYPES.includes(tiles[pos.y][pos.x].type as TileType) &&
                        tiles[pos.y][pos.x].object?.type !== ObjectType.HealingSanctuary &&
                        tiles[pos.y][pos.x].object?.type !== ObjectType.CombatSanctuary,
                    );
                    if (!hasAccess) return false;
                }
            }
        }
        return true;
    }

    private checkDoorNeighbors(tiles: Tile[][]): boolean {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                const tile = tiles[y][x];
                if (tile.type === TileType.Door) {
                    const leftNeighborType = tiles[y][x - 1].type;
                    const rightNeighborType = tiles[y][x + 1].type;
                    const topNeighborType = tiles[y - 1][x].type;
                    const bottomNeighborType = tiles[y + 1][x].type;

                    const isConfig1 =
                        leftNeighborType === TileType.Wall && rightNeighborType === TileType.Wall &&
                        PLAYABLE_TYPES.includes(topNeighborType as TileType) && PLAYABLE_TYPES.includes(bottomNeighborType as TileType);

                    const isConfig2 =
                        topNeighborType === TileType.Wall && bottomNeighborType === TileType.Wall &&
                        PLAYABLE_TYPES.includes(leftNeighborType as TileType) && PLAYABLE_TYPES.includes(rightNeighborType as TileType);

                    if (!isConfig1 && !isConfig2) return false;
                }

            }
        }
        return true;
    }

    private validateFlagForCTF(gameData: Partial<Game>): string[] {
        if (gameData.gameMode !== GameModeValue.Ctf) {
            return [];
        }
        const tiles = gameData.mapConfig.tiles;
        let flagCount = 0;

        for (const row of tiles) {
            for (const tile of row) {
                if (tile.object?.type === ObjectType.Flag) {
                    flagCount++;
                }
            }
        }
        if (flagCount === 0) {
            return ['En mode CTF, le drapeau doit être placé sur la carte.'];
        }
        return [];
    }
}

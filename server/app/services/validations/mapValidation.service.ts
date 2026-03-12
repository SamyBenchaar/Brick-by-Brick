import { Game } from '@app/model/game';
import { Tile } from '@app/model/tile';
import { MapSize, MIN_TERRAIN_COVERAGE, PERCENTAGE_MULTIPLIER, PLAYABLE_TYPES, TileType } from '@common/map';
import { Injectable } from '@nestjs/common';
import { Direction, GridPosition } from '@app/interfaces/map-validation.interfaces';

@Injectable()
export class MapValidationService {

    async validateMap(gameData: Partial<Game>): Promise<string[]> {
        const errors: string[] = [];

        // Validation: Plus de 50% de la surface doit être du terrain jouable
        errors.push(...this.validateTerrainCoverage(gameData));

        // Validation: Tous les points de départ ont été placés
        errors.push(...this.validateStartingPoints(gameData));

        // Validation: Toutes les tuiles de terrain doivent être accessibles
        errors.push(...this.validateTerrainAccessibility(gameData));

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
                if (tile.object?.type === 'startingpoint') {
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

        // Trouver une tuile de départ
        const startPoint = this.findStartingPoint(tiles);
        if (!startPoint) {
            return ['Aucun point de départ trouvé pour vérifier l\'accessibilité'];
        }

        // BFS pour compter les tuiles accessibles
        const visited = Array(gridSize).fill(null).map(
            () => Array(gridSize).fill(false),
        );
        const queue: GridPosition[] = [];

        queue.push(startPoint);
        visited[startPoint.y][startPoint.x] = true;
        let accessibleTiles = 1;

        const directions: Direction[] = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
        ];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }

            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;

                // Vérifier les limites
                if (newX < 0 || newX >= gridSize || newY < 0 || newY >= gridSize) {
                    continue;
                }

                // Vérifier si déjà visité
                if (visited[newY][newX]) {
                    continue;
                }

                // Vérifier si la tuile est jouable
                const tile = tiles[newY][newX];
                if (!PLAYABLE_TYPES.includes(tile.type as TileType)) {
                    continue;
                }

                // Marquer comme visité et ajouter à la queue
                visited[newY][newX] = true;
                queue.push({ x: newX, y: newY });
                accessibleTiles++;
            }
        }

        // Vérifier si toutes les tuiles jouables sont accessibles
        if (accessibleTiles !== totalPlayableTiles) {
            return [
                `Certaines tuiles de terrain sont inaccessibles. ` +
                `Tuiles accessibles: ${accessibleTiles}/${totalPlayableTiles}`,
            ];
        }
        return [];
    }

    private countPlayableTiles(gameData: Partial<Game>): number {
        const tiles = gameData.mapConfig.tiles;
        let count = 0;

        for (const row of tiles) {
            for (const tile of row) {
                if (PLAYABLE_TYPES.includes(tile.type as TileType)) {
                    count++;
                }
            }
        }

        return count;
    }

    private findStartingPoint(tiles: Tile[][]): GridPosition | null {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                if (tiles[y][x].object?.type === 'startingpoint') {
                    return { x, y };
                }
            }
        }
        return null;
    }

}

import { Game, GameDocument } from '@app/model/database/game';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class MapValidationService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    ) {}

    async validateMap(gameData: Partial<Game>): Promise<void> {
        // Validation: Plus de 50% de la surface doit être du terrain jouable
        this.validateTerrainCoverage(gameData);

        // Validation: Tous les points de départ ont été placés
        this.validateStartingPoints(gameData);

        // Validation: Toutes les tuiles de terrain doivent être accessibles
        this.validateTerrainAccessibility(gameData);
    }

    private validateTerrainCoverage(gameData: Partial<Game>): void {
        const { gridSize } = gameData.mapConfig;
        const totalSurface = gridSize.width * gridSize.height;
        const playableTileCount = this.countPlayableTiles(gameData);

        const coverage = playableTileCount / totalSurface;

        if (coverage <= 0.5) {
            throw new BadRequestException(
                `La surface de terrain jouable est insuffisante: ${(coverage * 100).toFixed(1)}%. ` +
                `Au moins 50% de la surface doit être du terrain jouable.`
            );
        }
    }

    private validateStartingPoints(gameData: Partial<Game>): void {
        const numberOfStartingPoints = gameData.objects.startingPoints.length;

        if (numberOfStartingPoints !== gameData.numberOfPlayers) {
            throw new BadRequestException(
                `Le nombre de points de départ (${numberOfStartingPoints}) doit être égal au nombre de joueurs (${gameData.numberOfPlayers})`
            );
        }
    }

    private validateTerrainAccessibility(gameData: Partial<Game>): void {
        const { gridSize } = gameData.mapConfig;
        const playableTypes = ['base', 'ice', 'door'];
        const totalPlayableTiles = this.countPlayableTiles(gameData);

        // Trouver une tuile de départ (utiliser le premier starting point)
        const startPoint = gameData.objects.startingPoints[0];
        if (!startPoint) {
            throw new BadRequestException('Aucun point de départ trouvé pour vérifier l\'accessibilité');
        }

        // BFS pour compter les tuiles accessibles
        const visited = Array(gridSize.height).fill(null).map(
            () => Array(gridSize.width).fill(false)
        );
        const queue: Array<{ x: number; y: number }> = [];

        queue.push(startPoint);
        visited[startPoint.y][startPoint.x] = true;
        let accessibleTiles = 1;

        const directions = [
            { dx: 0, dy: -1 }, // haut
            { dx: 0, dy: 1 },  // bas
            { dx: -1, dy: 0 }, // gauche
            { dx: 1, dy: 0 },  // droite
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;

                // Vérifier les limites
                if (newX < 0 || newX >= gridSize.width || newY < 0 || newY >= gridSize.height) {
                    continue;
                }

                // Vérifier si déjà visité
                if (visited[newY][newX]) {
                    continue;
                }

                // Vérifier si la tuile est jouable
                const tile = gameData.tiles[newY][newX];
                if (!playableTypes.includes(tile.type)) {
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
            throw new BadRequestException(
                `Certaines tuiles de terrain sont inaccessibles. ` +
                `Tuiles accessibles: ${accessibleTiles}/${totalPlayableTiles}`
            );
        }
    }

    private countPlayableTiles(gameData: Partial<Game>): number {
        const { gridSize } = gameData.mapConfig;
        const playableTypes = ['base', 'ice', 'door'];
        let count = 0;

        for (let y = 0; y < gridSize.height; y++) {
            for (let x = 0; x < gridSize.width; x++) {
                if (playableTypes.includes(gameData.tiles[y][x].type)) {
                    count++;
                }
            }
        }

        return count;
    }

}

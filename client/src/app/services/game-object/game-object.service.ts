import { Injectable, inject } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { ObjectPlacementContext } from '@app/interfaces/game-grid-payloads';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';

@Injectable({ providedIn: 'root' })
export class GameObjectService {
    private mapEditorService = inject(MapEditorService);
    private objectCounterService = inject(ObjectCounterService);

    private canPlaceOnTile(tile: Tile | null, isTileObjectFree: (t: Tile) => boolean): boolean {
        if (!tile || !isTileObjectFree(tile)) return false;
        const isObstacle = tile.type === TileType.Wall || tile.type === TileType.Door;
        return !isObstacle;
    }

    addObject(position: Position, selectedObject: ObjectType | null, placementContext: ObjectPlacementContext): void {
        const { getTile, isTileObjectFree } = placementContext;
        if (!selectedObject) return;
        if (!this.objectCounterService.canPlace(selectedObject)) return;

        const tile = getTile(position);
        if (!this.canPlaceOnTile(tile, isTileObjectFree)) return;

        const isSanctuary = selectedObject === ObjectType.HealingSanctuary || selectedObject === ObjectType.CombatSanctuary;
        if (isSanctuary) {
            this.addSanctuaryObject(position, selectedObject, placementContext);
        } else if (tile) {
            tile.object = selectedObject;
            this.objectCounterService.place(selectedObject);
            this.mapEditorService.setObject(position, selectedObject);
        }
    }

    removeObject(position: Position, getTile: (pos: Position) => Tile | null): void {
        const tile = getTile(position);
        if (!tile?.object) return;
        const objectType = tile.object;
        const isSanctuary = objectType === ObjectType.HealingSanctuary || objectType === ObjectType.CombatSanctuary;

        if (isSanctuary) {
            this.removeSanctuaryObject(position, getTile);
        } else {
            tile.object = undefined;
            this.mapEditorService.setObject(position, null);
        }
        this.objectCounterService.remove(objectType);
    }

    private addSanctuaryObject(position: Position, selectedObject: ObjectType, placementContext: ObjectPlacementContext): void {
        const { getTile, isTileObjectFree } = placementContext;
        const positions = [
            { x: position.x, y: position.y }, { x: position.x + 1, y: position.y },
            { x: position.x, y: position.y + 1 }, { x: position.x + 1, y: position.y + 1 },
        ];
        const tiles = positions.map(pos => getTile(pos));
        const cannotPlace = tiles.some(tile => !this.canPlaceOnTile(tile, isTileObjectFree));
        if (cannotPlace) return;

        (tiles as Tile[]).forEach((tile, index) => {
            tile.object = selectedObject;
            tile.sanctuaryOrigin = position;
            this.mapEditorService.setObject(positions[index], selectedObject);
        });
        this.objectCounterService.place(selectedObject);
        this.mapEditorService.setOrigin(position, true);
    }

    private removeSanctuaryObject(position: Position, getTile: (pos: Position) => Tile | null): void {
        const tile = getTile(position);
        const origin = tile?.sanctuaryOrigin ?? position;
        const positions = [
            { x: origin.x, y: origin.y }, { x: origin.x + 1, y: origin.y },
            { x: origin.x, y: origin.y + 1 }, { x: origin.x + 1, y: origin.y + 1 },
        ];
        positions.forEach(pos => {
            const currentTile = getTile(pos);
            if (currentTile) {
                currentTile.object = undefined;
                currentTile.sanctuaryOrigin = undefined;
            }
            this.mapEditorService.setObject(pos, null);
            this.mapEditorService.setOrigin(pos, false);
        });
    }
}

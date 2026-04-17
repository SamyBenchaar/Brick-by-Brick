import { Injectable, inject } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { DoorState, TileType } from '@common/map';
import { Position } from '@common/position';

@Injectable({
    providedIn: 'root',
})
export class TileOperationsService {
    private mapEditorService = inject(MapEditorService);
    private objectCounterService = inject(ObjectCounterService);

    changeTileType(tile: Tile | null, position: Position): void {
        const selectedType = this.mapEditorService.getSelectedTileType();
        if (!tile || !selectedType) return;

        if (selectedType === TileType.Wall && tile.object) {
            this.removeObject(tile, position);
        }

        if (selectedType === TileType.Door && tile.object) {
            this.removeObject(tile, position);
        }

        if (selectedType === TileType.Door) {
            tile.doorState = tile.doorState === DoorState.Closed ? DoorState.Opened : DoorState.Closed;
        } else {
            tile.doorState = undefined;
        }

        tile.type = selectedType;
        this.mapEditorService.setTileType(position, selectedType);
        this.mapEditorService.setDoorState(position, tile.doorState);
    }

    removeObject(tile: Tile | null, position: Position): void {
        if (tile && tile.object) {
            this.objectCounterService.remove(tile.object);
            tile.object = undefined;
            this.mapEditorService.setObject(position, null);
        }
    }

}

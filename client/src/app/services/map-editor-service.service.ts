import { Injectable, signal } from '@angular/core';
import { ObjectType, TileType } from '@common/map';


@Injectable({
  providedIn: 'root',
})
export class MapEditorServiceService {
  private  selectedTileType = signal<TileType >(TileType.Base);
  private  selectedObject = signal<ObjectType|null>(null);

  selectTileType(type: TileType): void {
    this.selectedTileType.set(type);

  }

  selectObject(type: ObjectType): void {
    this.selectedObject.set(type);
  }

  getSelectedTileType(): TileType {
    return this.selectedTileType();
  }

  getSelectedObject(): ObjectType | null {
    return this.selectedObject();
  }
} 
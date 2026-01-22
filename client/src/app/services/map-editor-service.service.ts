import { Injectable, signal } from '@angular/core';
import { ObjectType, TileType } from '@common/map';


@Injectable({
  providedIn: 'root',
})
export class MapEditorServiceService {
  private  selectedTileType = signal<TileType|null>(null);
  private  selectedObject = signal<ObjectType|null>(null);

  selectTileType(type: TileType): void {
    this.selectedTileType.set(type);
    this.selectedObject.set(null);
  }

  selectObject(type: ObjectType): void {
    this.selectedObject.set(type);
    this.selectedTileType.set(null);
  }

  getSelectedTileType(): TileType | null{
    return this.selectedTileType();
  }

  getSelectedObject(): ObjectType | null {
    return this.selectedObject();
  }
} 
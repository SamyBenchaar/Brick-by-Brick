import { Injectable, signal } from '@angular/core';
import { TileType } from '@common/map';


@Injectable({
  providedIn: 'root',
})
export class MapEditorServiceService {
  private  selectedTileType = signal<TileType>(TileType.Base);

  selectTileType(type: TileType): void {
    this.selectedTileType.set(type);

  }

  getSelectedTileType(): TileType {
    return this.selectedTileType();
  }
} 
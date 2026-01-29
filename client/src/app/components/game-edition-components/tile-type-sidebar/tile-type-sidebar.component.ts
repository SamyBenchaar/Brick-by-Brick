import { Component, inject } from '@angular/core';
import { Tile } from '@app/classes/tile';
import { TileType } from '@common/map';
import { CommonModule } from '@angular/common';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { TILE_TYPE_DESCRIPTIONS } from '@app/constants/tile-type-description';

@Component({
  selector: 'app-tile-type-sidebar',
  imports: [CommonModule],
  templateUrl: './tile-type-sidebar.component.html',
  styleUrl: './tile-type-sidebar.component.scss',
})
export class TileTypeSidebarComponent {
  editableTypes = Tile.editableTypes;

  
  private mapEditorService = inject(MapEditorServiceService);
  readonly tile = Tile;

  selectTileType(type: TileType): void {
    this.mapEditorService.selectTileType(type);
  }

  isSelected(type: TileType): boolean {
    return this.mapEditorService.getSelectedTileType() === type;
  }

  getTileTypeDescription(type: TileType): string {
    return TILE_TYPE_DESCRIPTIONS[type];
  }
  
  getTilePath(tile: TileType): string {
    return `assets/images/${tile}.jpg`;
  }

}

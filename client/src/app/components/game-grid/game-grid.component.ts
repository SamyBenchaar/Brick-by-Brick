import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { MapSize, GRID_SIZE } from '@common/map';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.scss',
})
export class GameGridComponent {

  readonly gridSize = GRID_SIZE;
  gameMap: GameMap;
  private mapEditorService = inject(MapEditorServiceService);
  private isDrawing = false;

  
  constructor() {
    this.gameMap = new GameMap(MapSize.Medium);
  }

  getGrid(): Tile[][] {
    return this.gameMap.getGrid();
  }

  getTileSize(): number {
    return this.gridSize / this.gameMap.getSize();
  }

  onTileMouseDown(x: number, y: number): void {
    if(this.mapEditorService.getSelectedTileType() == null) {
      this.addObject(x, y);
    } else {
      this.isDrawing = true;
      this.changeTileType(x,y);
    }
  }

  onTileMouseEnter(x: number, y: number): void {
    if (this.isDrawing) {
      this.changeTileType(x,y);
    }
  }

  @HostListener('mouseup')
  onTileMouseUp(): void {
    this.isDrawing = false;
  }

  private changeTileType(x: number, y: number): void {
    const selectedType = this.mapEditorService.getSelectedTileType();
    const tile = this.gameMap.getTile(x, y);
    if (tile && selectedType) {
      tile.type = selectedType;
    }
  }

  private addObject(x: number, y: number): void {
    const selectedObject = this.mapEditorService.getSelectedObject();
    const tile = this.gameMap.getTile(x, y);
    if (tile && selectedObject) {
      tile.object = selectedObject;
    }
  }
}
import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { ClickEvent } from '@app/constants/click-event-constants';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { GRID_SIZE, MapSize, ObjectType, TileType } from '@common/map';

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
  private isDeleting = false;


  constructor() {
    this.gameMap = new GameMap(MapSize.Small);
  }

  getGrid(): Tile[][] {
    return this.gameMap.getGrid();
  }

  getTileSize(): number {
    return this.gridSize / this.gameMap.getSize();
  }

  onTileMouseDown(x: number, y: number, event: MouseEvent): void {
    if (event.button == ClickEvent.Left) {
      if (this.mapEditorService.getSelectedTileType() == null) {
        this.addObject(x, y);
      }
      else {
        this.isDrawing = true;
        this.changeTileType(x, y);
      }
    }
    if (event.button == ClickEvent.Right || event.ctrlKey) {
      event.preventDefault();//Pour ne pas ouvrir le menu contextuel
      this.isDeleting = true;
      const tile = this.gameMap.getTile(x, y);
      if (tile) {
        tile.type = TileType.Base;
      }
    }
  }

  onTileMouseEnter(x: number, y: number): void {
    if (this.isDeleting) {
      // Mode suppression: toujours remplacer par tuile de base, peu importe l'outil sélectionné
      const tile = this.gameMap.getTile(x, y);
      if (tile) {
        tile.type = TileType.Base;
      }
    } else if (this.isDrawing) {
      // Mode peinture: utiliser l'outil sélectionné
      this.changeTileType(x, y);
    }
  }

  @HostListener('mouseup')
  onTileMouseUp(): void {
    this.isDrawing = false;
    this.isDeleting = false;
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault(); // Empêche le menu contextuel d'apparaître
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

  getObjectPath(object: ObjectType): string {
    return `assets/images/${object}.png`;
  }

}
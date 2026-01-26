import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, Input, OnInit } from '@angular/core';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { ClickEvent } from '@app/constants/click-event-constants';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { GRID_SIZE, MapSize, ObjectType } from '@common/map';

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.scss',
})
export class GameGridComponent implements OnInit {
  @Input() mapSize: MapSize = MapSize.Small; // Taille par défaut

  readonly gridSize = GRID_SIZE;
  gameMap!: GameMap;
  private mapEditorService = inject(MapEditorServiceService);
  private isDrawing = false;


  ngOnInit(): void {
    // Initialiser la grille avec la taille reçue en input
    this.gameMap = new GameMap(this.mapSize);
  }

  getGrid(): Tile[][] {
    return this.gameMap.getGrid();
  }

  getTileSize(): number {
    return this.gridSize / this.gameMap.getSize();
  }

  onTileMouseDown(x: number, y: number, event: MouseEvent): void {
    if (event.button !== ClickEvent.Left) {
      return;
    }
    if (this.mapEditorService.getSelectedTileType() == null) {
      this.addObject(x, y);
    } else {
      this.isDrawing = true;
      this.changeTileType(x, y);
    }
  }

  onTileMouseEnter(x: number, y: number): void {
    if (this.isDrawing) {
      this.changeTileType(x, y);
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

  getObjectPath(object: ObjectType): string {
    return `assets/images/${object}.png`;
  }

}
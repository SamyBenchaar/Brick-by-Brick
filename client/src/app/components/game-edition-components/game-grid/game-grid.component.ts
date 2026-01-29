import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { ClickEvent } from '@app/constants/click-event-constants';
import { Game } from '@app/interfaces/game';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { GRID_SIZE, MapSize, ObjectType, TileType } from '@common/map';

@Component({
  selector: 'app-game-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.scss',
})
export class GameGridComponent implements OnChanges {

  @Input() gameData: Game | null = null;
  readonly gridSize = GRID_SIZE;
  gameMap: GameMap;
  private mapEditorService = inject(MapEditorServiceService);
  private objectCounterService = inject(ObjectCounterService);
  private isDrawing = false;
  private isDeleting = false;


  constructor() {
    this.gameMap = new GameMap(MapSize.Small);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['gameData'] && this.gameData) {
      this.loadGameData();
    }
  }

  private loadGameData(): void {
    if (!this.gameData) return;

    const size = this.gameData.mapConfig.size;

    let mapSize = MapSize.Small;
    if (size === 'Medium') mapSize = MapSize.Medium;
    else if (size === 'Large') mapSize = MapSize.Large;

    this.gameMap = new GameMap(mapSize);

    const tiles = this.gameData.mapConfig.tiles;

    if (tiles) {
      for (let y = 0; y < tiles.length; y++) {
        for (let x = 0; x < tiles[y].length; x++) {
          const tileData = tiles[y][x];
          const tile = this.gameMap.getTile(x, y);

          if (!tile) continue;

          tile.type = tileData.type as TileType;

          if (tileData.object) {
            tile.object = tileData.object.type as ObjectType;
            this.objectCounterService.place(tile.object);
          }
        }
      }
    } else {
      console.warn('No tiles data found in game config');
    }
  }

  getGrid(): Tile[][] {
    return this.gameMap.getGrid();
  }

  getTileSize(): number {
    return this.gridSize / this.gameMap.getSize();
  }

  onTileMouseDown(x: number, y: number, event: MouseEvent): void {
    if (event.button === ClickEvent.Left) {
      if (this.mapEditorService.getSelectedTileType() == null) {
        this.addObject(x, y);
      } else {
        this.isDrawing = true;
        this.changeTileType(x, y);
      }
    }
    if (event.button === ClickEvent.Right) {
      event.preventDefault();//Pour ne pas ouvrir le menu contextuel
      this.isDeleting = true;
      const tile = this.gameMap.getTile(x, y);
      if (tile) {
        tile.type = TileType.Base;
        tile.object = undefined;
      }
    }
  }

  onTileMouseEnter(x: number, y: number): void {
    if (this.isDeleting) {
      const tile = this.gameMap.getTile(x, y);
      if (tile) {
        tile.type = TileType.Base;
        tile.object = undefined;
      }
    } else if (this.isDrawing) {
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
    if (tile && selectedObject && this.objectCounterService.canPlace(selectedObject)) {
      tile.object = selectedObject;
      this.objectCounterService.place(selectedObject);
    }
  }

  getObjectPath(object: ObjectType): string {
    return `assets/images/${object}.png`;
  }

  getTilePath(tile: TileType): string {
    return `assets/images/${tile}.jpg`;
  }

}
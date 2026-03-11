import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { ClickEvent } from '@app/constants/click-event-constants';
import { OBJECT_DESCRIPTIONS } from '@app/constants/object-descriptions';
import { Game } from '@app/interfaces/game';
import { Position } from '@app/interfaces/position';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { GRID_SIZE, MapSize, ObjectType, TileType } from '@common/map';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-game-grid',
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.scss',
})
export class GameGridComponent implements OnInit, OnChanges {
  private static readonly defaultPreviewMaxWidth = 400;
  private static readonly jpegQuality = 0.3;

  @Input() mapSize: MapSize = MapSize.Small; // Taille par défaut

  @Input() gameData: Game | null = null;
  @Input() isViewMode: boolean = false; // true pour game-view, false pour edition
  readonly gridSize = GRID_SIZE;
  readonly objectDescriptions = OBJECT_DESCRIPTIONS;

  gameMap!: GameMap;
  private mapEditorService = inject(MapEditorServiceService);
  private objectCounterService = inject(ObjectCounterService);
  private isDrawing = false;
  private isDeleting = false;
  private isShiftPressed = false;


  constructor() {
    this.gameMap = new GameMap(MapSize.Small);
  }

  ngOnInit(): void {
    if (!this.isViewMode) {
      this.gameMap = new GameMap(this.mapSize);
    }
    this.objectCounterService.reset();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.gameData && this.gameData) {
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
          const position = { x, y };
          const tileData = tiles[position.y][position.x];
          const tile = this.gameMap.getTile(position);

          if (!tile) continue;

          tile.type = tileData.type as TileType;

          if (tileData.object) {
            tile.object = tileData.object.type as ObjectType;
            this.objectCounterService.place(tile.object);
          }
        }
      }
    }
  }

  getGrid(): Tile[][] {
    return this.gameMap.grid;
  }

  getTileSize(): number {
    return this.gridSize / this.gameMap.size;
  }

  getTile(position: Position): Tile | null {
    return this.gameMap.getTile(position);
  }

  onTileMouseDown(position: Position, event: MouseEvent): void {
    if (event.button === ClickEvent.Left) {
      if (this.mapEditorService.getSelectedTileType() == null) {
        this.addObject(position);
      } else {
        this.isDrawing = true;
        this.changeTileType(position);

      }
    }
    if (event.button === ClickEvent.Right) {
      event.preventDefault();//Pour ne pas ouvrir le menu contextuel
      this.isDeleting = true;
      this.applyDeletion(position);
    }
  }


  onTileMouseEnter(position: Position): void {
    if (this.isDeleting) {
      // Mode suppression: toujours remplacer par tuile de base, peu importe l'outil sélectionné
      this.applyDeletion(position);
    } else if (this.isDrawing) {
      this.changeTileType(position);
    }
  }

  @HostListener('document:mouseup')
  onTileMouseUp(): void {
    this.isDrawing = false;
    this.isDeleting = false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.isShiftPressed = true;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.isShiftPressed = false;
    }
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault(); // Empêche le menu contextuel d'apparaître
  }

  resetGrid(): void {
    this.gameMap = new GameMap(this.mapSize);
    this.objectCounterService.reset();
  }

  applyDeletion(position: Position): void {
    const tile = this.getTile(position);
    if (tile) {
      if (this.isShiftPressed) {
        this.removeObject(position);
      } else {
        tile.type = TileType.Base;
        this.mapEditorService.setTileType(position, TileType.Base);
      }
    }
  }

  private changeTileType(position: Position): void {
    const selectedType = this.mapEditorService.getSelectedTileType();
    const tile = this.getTile(position);
    if (tile && selectedType) {
      if (selectedType === TileType.Wall && tile.object) {
        this.removeObject(position);
      }
      tile.type = selectedType;
      this.mapEditorService.setTileType(position, selectedType);
    }
  }

  isTileObjectFree(tile: Tile): boolean {
    if (tile) {
      return !tile.object;
    }
    return true;
  }

  private addObject(position: Position): void {
    const selectedObject = this.mapEditorService.getSelectedObject();
    const tile = this.getTile(position);
    if (tile && selectedObject && this.objectCounterService.canPlace(selectedObject) && this.isTileObjectFree(tile)) {
      if (tile.type === 'wall') {
        return;
      }
      tile.object = selectedObject;
      this.objectCounterService.place(selectedObject);
      this.mapEditorService.setObject(position, selectedObject);
    }
  }

  private removeObject(position: Position): void {
    const tile = this.getTile(position);
    if (tile && tile.object) {
      this.objectCounterService.remove(tile.object);
      tile.object = undefined;
      this.mapEditorService.setObject(position, null);
    }
  }

  getObjectPath(object: ObjectType): string {
    return `./assets/images/${object}.png`;
  }

  getTilePath(tile: TileType): string {
    return `./assets/images/${tile}.jpg`;
  }

  async captureMapPreview(maxWidth: number = GameGridComponent.defaultPreviewMaxWidth): Promise<string> {
    try {
      const gridElement = document.querySelector('.grid-container') as HTMLElement;
      if (!gridElement) return '';
      const scale = Math.min(1, maxWidth / gridElement.offsetWidth);
      const gridCanva = await html2canvas(gridElement, {
        scale,
        backgroundColor: null,
        logging: false,
      });
      return gridCanva.toDataURL('image/jpeg', GameGridComponent.jpegQuality);

    } catch {
      return '';
    }
  }
}
import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { ClickEvent } from '@app/constants/click-event-constants';
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
export class GameGridComponent {

  readonly gridSize = GRID_SIZE;
  gameMap: GameMap;
  private mapEditorService = inject(MapEditorServiceService);
  private objectCounterService = inject(ObjectCounterService);
  private isDrawing = false;
  private isDeleting = false;
  private isShiftPressed = false;


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
      this.applyDeletion(x, y);
      }  
  }


  onTileMouseEnter(x: number, y: number): void {
    if (this.isDeleting) {
      // Mode suppression: toujours remplacer par tuile de base, peu importe l'outil sélectionné
      this.applyDeletion(x, y);
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

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event:KeyboardEvent): void {
    if(event.key === 'Shift'){
      this.isShiftPressed = true;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event:KeyboardEvent): void {
    if(event.key === 'Shift'){
      this.isShiftPressed = false;
    }
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault(); // Empêche le menu contextuel d'apparaître
  }

  applyDeletion(x: number, y:number): void {
    const tile = this.gameMap.getTile(x, y);
    if (tile) {
      if(this.isShiftPressed){
        this.removeObject(x, y);
      } else{ 
      tile.type = TileType.Base;
      }
    }
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
  
  private removeObject(x: number, y: number): void {
    const tile = this.gameMap.getTile(x, y);
    if (tile && tile.object) {
      this.objectCounterService.remove(tile.object);
      tile.object = undefined;
    }
  }

  getObjectPath(object: ObjectType): string {
    return `assets/images/${object}.png`;
  }

  getTilePath(tile: TileType): string {
    return `assets/images/${tile}.jpg`;
  }

}
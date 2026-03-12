import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameMap } from '@app/classes/game-map';
import { Tile } from '@app/classes/tile';
import { AVATARS } from '@app/constants/character.constants';
import { ClickEvent } from '@app/constants/click-event-constants';
import { GameSize } from '@app/constants/game-size.enum';
import { OBJECT_DESCRIPTIONS } from '@app/constants/object-descriptions';
import { Game } from '@app/interfaces/game';
import { Position } from '@app/interfaces/position';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket.service';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { Character } from '@common/character';
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

  @Input() mapSize: MapSize = MapSize.Small;

  @Input() gameData: Game | null = null;
  @Input() isViewMode: boolean = false;
  @Input() players: Character[] = [];
  @Input() reachableTiles: Position[] = [];

  readonly gridSize = GRID_SIZE;
  readonly objectDescriptions = OBJECT_DESCRIPTIONS;

  gameMap!: GameMap;
  private mapEditorService = inject(MapEditorServiceService);
  private objectCounterService = inject(ObjectCounterService);
  private gameSessionSocketService = inject(GameSessionSocketService);
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
    if (size === GameSize.MEDIUM) mapSize = MapSize.Medium;
    else if (size === GameSize.LARGE) mapSize = MapSize.Large;

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
    if (this.isViewMode) {
      return;
    }

    if (event.button === ClickEvent.Left) {
      if (this.mapEditorService.getSelectedTileType() == null) {
        this.addObject(position);
      } else {
        this.isDrawing = true;
        this.changeTileType(position);
      }
    }
    if (event.button === ClickEvent.Right) {
      event.preventDefault();
      this.isDeleting = true;
      this.applyDeletion(position);
    }
  }

  onTileRightClick(position: Position, event: MouseEvent): void {
    if (!this.isViewMode) {
      return;
    }

    event.preventDefault();

    const tile = this.getTile(position);
    const playerAtPosition = this.getPlayerAtPosition(position);

    if (playerAtPosition) {
      alert(`Joueur: ${playerAtPosition.name}\nAvatar ID: ${playerAtPosition.avatarId}\nVictoires: ${playerAtPosition.victories}`);
    } else if (tile) {
      const cost = this.getTileCost(tile.type);
      alert(`Type: ${tile.type}\nCoût de déplacement: ${cost}`);
    }
  }

  onTileClick(position: Position): void {
    if (!this.isViewMode) {
      return;
    }

    if (!this.gameSessionSocketService.isMyTurn()) {
      return;
    }

    const playerAtPosition = this.getPlayerAtPosition(position);
    if (playerAtPosition) {
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer && currentPlayer.position && this.isAdjacent(currentPlayer.position, position)) {
        if (confirm(`Attaquer ${playerAtPosition.name}?`)) {
          this.gameSessionSocketService.requestCombat(playerAtPosition.id);
        }
      }
    }
  }


  onTileMouseEnter(position: Position): void {
    if (this.isViewMode) {
      return;
    }

    if (this.isDeleting) {
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
    event.preventDefault();
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
      if (tile.type === TileType.Wall) {
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

  getPlayerAtPosition(position: Position): Character | null {
    return this.players.find(p => p.position?.x === position.x && p.position?.y === position.y) ?? null;
  }

  isReachableTile(position: Position): boolean {
    return this.reachableTiles.some(t => t.x === position.x && t.y === position.y);
  }

  getAvatarImage(avatarId: number): string {
    return AVATARS.find(a => a.id === avatarId)?.image ?? 'assets/images/lily.jpg';
  }

  getCurrentPlayer(): Character | null {
    const socketId = this.gameSessionSocketService.getSocketId();
    const session = this.gameSessionSocketService.currentSession();
    if (!session) return null;
    
    const playerData = session.players.find(p => p.socketId === socketId);
    return playerData?.character ?? null;
  }

  private isAdjacent(pos1: Position, pos2: Position): boolean {
    const distance = Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    return distance === 1;
  }

  private getTileCost(tileType: TileType): number {
    switch (tileType) {
      case TileType.Base:
        return 1;
      case TileType.Water:
        return 2;
      case TileType.Ice:
        return 0;
      default:
        return 0;
    }
  }
}
import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameMap } from '@app/classes/game-map/game-map';
import { Tile } from '@app/classes/tile/tile';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { AVATARS } from '@app/constants/character-constants';
import { ClickEvent } from '@app/constants/click-event-constants';
import { GameSize } from '@app/constants/game-size.enum';
import { OBJECT_DESCRIPTIONS } from '@app/constants/object-descriptions';
import { Game } from '@app/interfaces/game';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { Character } from '@common/character';
import { DoorState, GRID_SIZE, MapSize, ObjectType, PLAYABLE_TYPES, TILE_COST, TileType } from '@common/map';
import { Position } from '@common/position';
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
  @Input() isActionSelectionMode: boolean = false;
  @ViewChild('gridContainer') gridContainer!: ElementRef<HTMLElement>;

  @Output() attackTargetSelected = new EventEmitter<Character>();
  @Output() actionTargetSelected = new EventEmitter<{tile: Tile, position: Position}>();

  readonly gridSize = GRID_SIZE;
  readonly objectDescriptions = OBJECT_DESCRIPTIONS;

  gameMap!: GameMap;
  private mapEditorService = inject(MapEditorService);
  private objectCounterService = inject(ObjectCounterService);
  private gameSessionSocketService = inject(GameSessionSocketService);
  private gamePlaySocketService = inject(GamePlaySocketService);
  private dialog = inject(MatDialog);
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
          tile.doorState = undefined;
          if (tileData.type === TileType.Door) {
            tile.doorState = (tileData.doorState as DoorState) ?? DoorState.Closed;
          }
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
      if (event.button === ClickEvent.Left && this.isActionSelectionMode) {
        const playerAtPos = this.getPlayerAtPosition(position);
        if (playerAtPos) {
          this.handleAttackTargetSelection(position);
        } else {
          this.handleActionTargetSelection(position);
        }
      }
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

    if (this.tryDebugTeleport(position, tile, playerAtPosition)) {
      return;
    }
    if (playerAtPosition) {
      this.openPlayerDialog(playerAtPosition);
    } else if (tile) {
      this.openTileDialog(tile);
    }
  }

  private openPlayerDialog(player: Character): void {
    this.dialog.open(AppDialogComponent, {
      data: {
        title: 'Informations du joueur',
        message: `Joueur: ${player.name}\nAvatar ID: ${player.avatarId}\nVictoires: ${player.victories}`,
        type: 'info',
      },
    });
  }

  private openTileDialog(tile: Tile): void {
    this.dialog.open(AppDialogComponent, {
      data: {
        title: 'Informations de la tuile',
        message: `Type: ${tile.type}\nCoût: ${this.getTileCost(tile.type)}`,
        type: 'info',
      },
    });
  }

  private isTileValidForTeleport(tile: Tile | null, player: Character | null): boolean {
    const isEmpty = !!tile && !tile.object;
    const hasNoPlayer = !player;
    const isWalkable = tile ? PLAYABLE_TYPES.includes(tile.type) : false;
    return isEmpty && hasNoPlayer && isWalkable;
  }

  private tryDebugTeleport(position: Position, tile: Tile | null, player: Character | null): boolean {
    const isDebug = this.gamePlaySocketService.isDebugModeActivated();
    const isMyTurn = this.gamePlaySocketService.isMyTurn();

    if (!isDebug || !isMyTurn) return false;
    if (!this.isTileValidForTeleport(tile, player)) return false;

    this.gamePlaySocketService.requestAssignPosition(position);
    return true;
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
        tile.doorState = undefined;
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
      if (selectedType === TileType.Door) {
        tile.doorState= tile.doorState === DoorState.Closed ? DoorState.Opened : DoorState.Closed;
      } else {
        tile.doorState = undefined;
      }
      tile.type = selectedType;
      this.mapEditorService.setTileType(position, selectedType);
      this.mapEditorService.setDoorState(position, tile.doorState);
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

    if (!tile || !selectedObject) return;
    if (!this.objectCounterService.canPlace(selectedObject)) return;
    if (!this.isTileObjectFree(tile)) return;
    if (tile.type === TileType.Wall || tile.type === TileType.Door) return;

    tile.object = selectedObject;
    this.objectCounterService.place(selectedObject);
    this.mapEditorService.setObject(position, selectedObject);
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

  getTilePath(tile: TileType, doorState?: DoorState): string {
    if (tile === TileType.Door) {
      // images de portes temporaires
      return `./assets/images/${doorState}-door.jpg`;
    } else {
      return `./assets/images/${tile}.jpg`;
    }
  }

  async captureMapPreview(maxWidth: number = GameGridComponent.defaultPreviewMaxWidth): Promise<string> {
    try {
      const gridElement = this.gridContainer?.nativeElement;
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

  private handleActionTargetSelection(position: Position): void {
    const target = this.getTile(position);
    if (!target) return;
    this.actionTargetSelected.emit({tile: target, position});
  }

  private handleAttackTargetSelection(position: Position): void {
    const target = this.getPlayerAtPosition(position);
    if (!target) {
      return;
    }

    if (!this.gamePlaySocketService.canAttackTarget(target)) {
      return;
    }

    this.attackTargetSelected.emit(target);
  }

  private getTileCost(tileType: TileType): number {
    return TILE_COST[tileType] ?? 0;
  }
}
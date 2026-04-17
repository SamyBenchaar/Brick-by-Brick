import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { GameMap } from '@app/classes/game-map/game-map';
import { Tile } from '@app/classes/tile/tile';
import { ClickEvent } from '@app/constants/click-event-constants';
import { GameSize } from '@app/constants/game-size.enum';
import { Game } from '@app/interfaces/game';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameGridUtilService } from '@app/services/game-grid-util/game-grid-util.service';
import { TileOperationsService } from '@app/services/game-grid/tile-operations.service';
import { GameObjectService } from '@app/services/game-object/game-object.service';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { Character } from '@common/character';
import { GameModeValue } from '@common/constants/game-config-constants';
import { DoorState, GRID_SIZE, MapSize, ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-game-grid',
  imports: [CommonModule],
  templateUrl: './game-grid.component.html',
  styleUrl: './game-grid.component.scss',
})
export class GameGridComponent implements OnInit, OnChanges {
  private static readonly defaultPreviewMaxWidth = 400;
  private static readonly jpegQuality = 0.3;

  gameModeValue = GameModeValue;

  @Input() mapSize: MapSize = MapSize.Small;

  @Input() gameData: Game | null = null;
  @Input() isViewMode: boolean = false;
  @Input() players: Character[] = [];
  @Input() gameMode: string = 'classic';
  @Input() reachableTiles: Position[] = [];
  @Input() isActionSelectionMode: boolean = false;
  @Input() flagHolderId: string | null = null;
  @Input() flagPosition: Position | null = null;
  @Input() startingPoints: Map<string, Position> | Record<string, Position> | null = null;
  @Input() currentPlayerId: string = '';
  @ViewChild('gridContainer') gridContainer!: ElementRef<HTMLElement>;

  @Output() attackTargetSelected = new EventEmitter<Character>();
  @Output() actionTargetSelected = new EventEmitter<{ tile: Tile, position: Position }>();

  readonly gridSize = GRID_SIZE;

  gameMap!: GameMap;
  private mapEditorService = inject(MapEditorService);
  private objectCounterService = inject(ObjectCounterService);
  private gamePlaySocketService = inject(GamePlaySocketService);
  private gameGridUtilService = inject(GameGridUtilService);
  private gameObjectService = inject(GameObjectService);
  private tileOperationsService = inject(TileOperationsService);
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
    if (changes.gameData && this.gameData) this.loadGameData();

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
            if (tileData.isOrigin) {
              this.objectCounterService.place(tile.object);
              [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([dx, dy]) => {
                const t = this.gameMap.getTile({ x: x + dx, y: y + dy });
                if (t) t.sanctuaryOrigin = { x, y };
              });
              tile.sanctuaryCooldown = tileData.sanctuaryCooldown;
            } else if (!this.isMultiTileObject(tile.object)) {
              this.objectCounterService.place(tile.object);
            }
          }
        }
      }
    }
  }

  getGrid(): Tile[][] {
    return this.gameMap.grid;
  }

  getTile(position: Position): Tile | null {
    return this.gameMap.getTile(position);
  }

  onTileMouseDown(position: Position, event: MouseEvent): void {
    if (this.isViewMode) {
      if (event.button === ClickEvent.Left && this.isActionSelectionMode) {
        const playerAtPos = this.getPlayerAtPosition(position);
        if (playerAtPos) this.handleAttackTargetSelection(position);

        else this.handleActionTargetSelection(position);

      }
      return;
    }

    if (event.button === ClickEvent.Left) {
      if (!this.mapEditorService.getSelectedTileType()) {
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
      this.gameGridUtilService.openPlayerDialog(playerAtPosition);
    } else if (tile) {
      this.gameGridUtilService.openTileDialog(tile);
    }
  }

  private tryDebugTeleport(position: Position, tile: Tile | null, player: Character | null): boolean {
    const isDebug = this.gamePlaySocketService.isDebugModeActivated();
    const isMyTurn = this.gamePlaySocketService.isMyTurn();

    if (!isDebug || !isMyTurn) return false;
    if (!this.gameGridUtilService.isTileValidForTeleport(tile, player)) return false;

    if (this.flagPosition && position.x === this.flagPosition.x && position.y === this.flagPosition.y) {
      return false;
    }

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
    const tile = this.getTile(position);
    this.tileOperationsService.changeTileType(tile, position);
  }

  isTileObjectFree(tile: Tile): boolean {
    return this.gameGridUtilService.isTileObjectFree(tile);
  }

  private addObject(position: Position): void {
    const selectedObject = this.mapEditorService.getSelectedObject();
    this.gameObjectService.addObject(position, selectedObject, {
      getTile: tilePosition => this.getTile(tilePosition),
      isTileObjectFree: tile => this.isTileObjectFree(tile),
    });
  }

  private removeObject(position: Position): void {
    this.gameObjectService.removeObject(position, tilePosition => this.getTile(tilePosition));
  }

  isMultiTileObject(object: ObjectType): boolean {
    return this.gameGridUtilService.isMultiTileObject(object);
  }

  isCurrentPlayerStartingPoint(position: Position): boolean {
    if (!this.startingPoints || !this.currentPlayerId) return false;

    let startPos: Position | undefined;

    if (this.startingPoints instanceof Map) {
      startPos = this.startingPoints.get(this.currentPlayerId);
    } else {
      startPos = (this.startingPoints as Record<string, Position>)[this.currentPlayerId];
    }

    if (!startPos) return false;
    return startPos.x === position.x && startPos.y === position.y;
  }

  getObjectPath(object: ObjectType, sanctuaryCooldown?: number, position?: Position): string {
    if (object === ObjectType.StartingPoint && position && this.isCurrentPlayerStartingPoint(position)) {
      return './assets/images/your_startingpoint.png';
    }
    return this.gameGridUtilService.getObjectPath(object, sanctuaryCooldown);
  }

  isSanctuaryOriginTile(tile: Tile, position: Position): boolean {
    return this.gameGridUtilService.isSanctuaryOriginTile(tile, position);
  }

  getTilePath(tile: TileType, doorState?: DoorState): string {
    return this.gameGridUtilService.getTilePath(tile, doorState);
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

  getPlayerTeamClass(player: Character): string {
    return this.gameGridUtilService.getPlayerTeamClass(player, this.gameMode);
  }

  getPlayerAtPosition(position: Position): Character | null {
    return this.players.find(player => player.position?.x === position.x && player.position?.y === position.y) ?? null;
  }

  isReachableTile(position: Position): boolean {
    return this.reachableTiles.some(tilePosition => tilePosition.x === position.x && tilePosition.y === position.y);
  }

  isInteractableTile(position: Position): boolean {
    const player = this.getPlayerAtPosition(position);
    if (player) {
      return (this.gamePlaySocketService.canAttackTarget(player) ||
        this.gamePlaySocketService.canTransferFlagTo(player) ||
        this.gamePlaySocketService.canRequestFlagFrom(player));
    } else {
      const tile = this.getTile(position);
      if (!tile) return false;
      return this.gamePlaySocketService.canInteractWithTarget(tile, position);
    }
  }

  getAvatarImage(avatarId: number): string {
    return this.gameGridUtilService.getAvatarImage(avatarId);
  }

  isFlagVisible(tile: Tile): boolean {
    return this.gameGridUtilService.isFlagVisible(tile, {
      gameMode: this.gameMode,
      flagPosition: this.flagPosition,
      flagHolderId: this.flagHolderId,
    });
  }

  isFlagAtPosition(position: Position): boolean {
    return this.gameGridUtilService.isFlagAtPosition(position, {
      gameMode: this.gameMode,
      flagHolderId: this.flagHolderId,
      flagPosition: this.flagPosition,
    });
  }

  private handleActionTargetSelection(position: Position): void {
    const target = this.getTile(position);
    if (!target) return;
    this.actionTargetSelected.emit({ tile: target, position });
  }

  private handleAttackTargetSelection(position: Position): void {
    const target = this.getPlayerAtPosition(position);
    if (!target) {
      return;
    }

    const canInteract = this.gamePlaySocketService.canAttackTarget(target) ||
      this.gamePlaySocketService.canTransferFlagTo(target);

    if (!canInteract) {
      return;
    }

    this.attackTargetSelected.emit(target);
  }

  private isInteractionModeActive(): boolean {
    return this.isViewMode && this.isActionSelectionMode;
  }

  private canTileBeNormallyInteracted(tile: Tile, position: Position): boolean {
    return !this.isSanctuaryOriginTile(tile, position) && !tile.sanctuaryOrigin;
  }

  canTileBeInteracted(tile: Tile, position: Position): boolean {
    if (!this.isInteractionModeActive()) return false;
    if (!this.isInteractableTile(position)) return false;
    return this.canTileBeNormallyInteracted(tile, position);
  }

  canTileBeInteractedAsOrigin(position: Position): boolean {
    if (!this.isInteractionModeActive()) return false;
    if (!this.isInteractableTile(position)) return false;
    const tile = this.getTile(position);
    return tile ? this.isSanctuaryOriginTile(tile, position) : false;
  }
}
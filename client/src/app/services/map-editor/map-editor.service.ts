import { Injectable, signal } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { DoorState, ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';


@Injectable({
  providedIn: 'root',
})
export class MapEditorService {
  private selectedTileType = signal<TileType | null>(null);
  private selectedObject = signal<ObjectType | null>(null);
  private currentGame = signal<Game | null>(null);


  selectTileType(type: TileType): void {
    this.selectedTileType.set(type);
    this.selectedObject.set(null);
  }

  selectObject(type: ObjectType): void {
    this.selectedObject.set(type);
    this.selectedTileType.set(null);
  }

  getSelectedTileType(): TileType | null {
    return this.selectedTileType();
  }

  getSelectedObject(): ObjectType | null {
    return this.selectedObject();
  }

  getCurrentGame(): Game | null {
    return this.currentGame();
  }

  setCurrentGame(game: Game | null): void {
    this.currentGame.set(game);
  }

  setTileType(position: Position, type: TileType): void {
    const game = this.currentGame();
    if (game) {
      game.mapConfig.tiles[position.y][position.x].type = type;
      this.currentGame.set(game);
    }
  }

  setDoorState(position: Position, state: DoorState | undefined): void {
    const game = this.currentGame();
    if (game) {
      game.mapConfig.tiles[position.y][position.x].doorState = state;
      this.currentGame.set(game);
    }
  }

  setObject(position: Position, type: ObjectType | null): void {
    const game = this.currentGame();
    if (game) {
      if (type) {
        game.mapConfig.tiles[position.y][position.x].object = { type };
      } else {
        delete game.mapConfig.tiles[position.y][position.x].object;
      }
      this.currentGame.set(game);
    }
  }

  setTitle(title: string): void {
    const game = this.currentGame();
    if (game) {
      game.name = title;
      this.currentGame.set(game);
    }
  }

  setDescription(description: string): void {
    const game = this.currentGame();
    if (game) {
      game.description = description;
      this.currentGame.set(game);
    }
  }

  setImagePreview(previewImage: string): void {
    const game = this.currentGame();
    if (game) {
      game.previewImage = previewImage;
      this.currentGame.set(game);
    }
  }
} 
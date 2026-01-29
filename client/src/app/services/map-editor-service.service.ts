import { Injectable, signal } from '@angular/core';
import { Game } from '@app/interfaces/game';
import { ObjectType, TileType } from '@common/map';


@Injectable({
  providedIn: 'root',
})
export class MapEditorServiceService {
  private  selectedTileType = signal<TileType|null>(null);
  private  selectedObject = signal<ObjectType|null>(null);
  private currentGame= signal<Game | null>(null);
  

  selectTileType(type: TileType): void {
    this.selectedTileType.set(type);
    this.selectedObject.set(null);
  }

  selectObject(type: ObjectType): void {
    this.selectedObject.set(type);
    this.selectedTileType.set(null);
  }

  getSelectedTileType(): TileType | null{
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

  setTileType(x: number, y: number, type: TileType): void {
    const game = this.currentGame();
    console.log("SETTILETYPE DANS MAP EDITOR SERVICE",game);
    if (game) {
      game.mapConfig.tiles[y][x].type = type;
      this.currentGame.set(game);
    }
    console.log("APRES SETTILETYPE DANS MAP EDITOR SERVICE",this.currentGame());
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
} 
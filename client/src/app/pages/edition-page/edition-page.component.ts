import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
// import { Tile } from '@app/classes/tile';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/game-edition-components/object-sidebar/object-sidebar.component';
import { TextInputComponent } from '@app/components/game-edition-components/text-input/text-input.component';
import { TileTypeSidebarComponent } from '@app/components/game-edition-components/tile-type-sidebar/tile-type-sidebar.component';
import { CommunicationService } from '@app/services/communication/communication.service';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { MapSize } from '@common/map';


@Component({
  selector: 'app-edition-page',
  imports: [GameGridComponent, TileTypeSidebarComponent, ObjectSidebarComponent, TextInputComponent],
  templateUrl: './edition-page.component.html',
  styleUrl: './edition-page.component.scss',
})
export class EditionPageComponent implements OnInit {
  private static readonly mediumMaxPlayers = 4;
  private static readonly largeMaxPlayers = 6;
  @ViewChild(GameGridComponent) gameGridComponent!: GameGridComponent;
  selectedSize: 'Small' | 'Medium' | 'Large' = 'Small';
  gridDimensions = { width: MapSize.Small, height: MapSize.Small }; // Valeur par défaut
  gameName: string = '';
  gameDescription: string = '';
  gameId: string = '';
  gameMode: 'classic' | 'ctf' = 'classic';

  constructor(
    private route: ActivatedRoute,
    private communicationService: CommunicationService,
    private mapEditorService: MapEditorServiceService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.gameId = params.get('game_id') || '';
      if (this.gameId) {
        this.loadGame();
      }
    });

    const paramss = this.route.snapshot.queryParams;
    this.selectedSize = paramss.size || 'Small';
    this.gameMode = paramss.mode || 'classic';

  }

  getMapEditorService(): MapEditorServiceService {
    return this.mapEditorService;
  }

  getMapSize(): MapSize {
    switch (this.selectedSize) {
      case 'Small':
        return MapSize.Small;
      case 'Medium':
        return MapSize.Medium;
      case 'Large':
        return MapSize.Large;
      default:
        return MapSize.Small; // Par défaut
    }
  }


  private loadGame(): void {
    this.communicationService.getGameById(this.gameId).subscribe((game) => {
      if (game) {
        this.mapEditorService.setCurrentGame(game);
        this.gameName = game.name;
        this.gameDescription = game.description;
      }
    });
  }

  private getMaxPlayers(): number {
    switch (this.selectedSize) {
      case 'Small':
        return 2;
      case 'Medium':
        return EditionPageComponent.mediumMaxPlayers;
      case 'Large':
        return EditionPageComponent.largeMaxPlayers;
      default:
        return 2;
    }
  }

  async onSave(): Promise<void> {
    if (this.gameId !== '') {
      const currentGame = this.mapEditorService.getCurrentGame();
      if (!currentGame) {
        return;
      }
      currentGame.previewImage = await this.gameGridComponent.captureMapPreview();
      this.communicationService.updateGame(this.gameId, currentGame).subscribe({
        next: async (updatedGame) => {
          this.mapEditorService.setCurrentGame(updatedGame);
          this.router.navigate(['/admin']);
        },
      });
    } else {
      const grid = this.gameGridComponent.gameMap.getGrid();
      const tiles = grid.map(row =>
        row.map(tile => {
          const tileData: { type: string; object?: { type: string } } = { type: tile.type };
          if (tile.object) {
            tileData.object = { type: tile.object };
          }
          return tileData;
        }),
      );
      const gameData = {
        name: this.gameName,
        description: this.gameDescription,
        isVisible: false,
        numberOfPlayers: this.getMaxPlayers(),
        gameMode: this.gameMode,
        previewImage: await this.gameGridComponent.captureMapPreview(),
        mapConfig: {
          size: this.selectedSize.charAt(0).toUpperCase() + this.selectedSize.slice(1),
          tiles,
        },

      };
      this.communicationService.createGame(gameData).subscribe({
        next: () => {
          this.router.navigate(['/admin']);
        },
      });
    }
  }

  onReset(): void {
    const currentGame = this.mapEditorService.getCurrentGame();
    if (currentGame) {
      this.gameName = currentGame.name;
      this.gameDescription = currentGame.description;
    }
  }
}
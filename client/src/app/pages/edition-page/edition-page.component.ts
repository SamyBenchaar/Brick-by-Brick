import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/game-edition-components/object-sidebar/object-sidebar.component';
import { TextInputComponent } from '@app/components/game-edition-components/text-input/text-input.component';
import { TileTypeSidebarComponent } from '@app/components/game-edition-components/tile-type-sidebar/tile-type-sidebar.component';
import { DialogType } from '@app/constants/dialog-type.enum';
import { DialogData, GameCreationData, GridDimensions, TileData } from '@app/interfaces/edition-page';
import { CommunicationService } from '@app/services/communication/communication.service';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { GameModeValue, GameSizeId, getGameSizeConfig } from '@common/constants/game-config-constants';
import { MapSize } from '@common/map';

@Component({
  selector: 'app-edition-page',
  imports: [GameGridComponent, TileTypeSidebarComponent, ObjectSidebarComponent, TextInputComponent, RouterLink],
  templateUrl: './edition-page.component.html',
  styleUrl: './edition-page.component.scss',
})
export class EditionPageComponent implements OnInit {
  private static readonly httpNotFound = 404;
  @ViewChild(GameGridComponent) gameGridComponent!: GameGridComponent;

  selectedSize: GameSizeId = 'Small';
  gameMode: GameModeValue = 'classic';

  gridDimensions: GridDimensions = { width: MapSize.Small, height: MapSize.Small };
  gameName: string = '';
  gameDescription: string = '';
  gameId: string = '';
  isSaving: boolean = false;

  private route = inject(ActivatedRoute);
  private communicationService = inject(CommunicationService);
  mapEditorService = inject(MapEditorServiceService);
  objectCounterService = inject(ObjectCounterService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramss => {
      this.gameId = paramss.get('game_id') || '';
      if (this.gameId) {
        this.loadGame();
      }
    });

    const params = this.route.snapshot.queryParams;
    if (params.size) {
      this.selectedSize = params.size as GameSizeId;
    }
    if (params.mode) {
      this.gameMode = params.mode as GameModeValue;
    }
  }

  getMapSize(): MapSize {
    const config = getGameSizeConfig(this.selectedSize);
    return config.gridSize;
  }


  private loadGame(): void {
    this.communicationService.getGameById(this.gameId).subscribe({
      next: (game) => {
        if (game) {
          this.selectedSize = game.mapConfig.size as GameSizeId;
          this.objectCounterService.startPoint = this.getMaxPlayers();
          this.mapEditorService.setCurrentGame(game);
          this.gameName = game.name;
          this.gameDescription = game.description;
        }
      },
      error: () => {
        const dialogData: DialogData = {
          title: 'Jeu introuvable',
          message: 'Le jeu demandé n\'existe pas ou a été supprimé.',
          type: DialogType.ERROR,
        };
        this.dialog.open(AppDialogComponent, {
          data: dialogData,
        }).afterClosed().subscribe(() => {
          this.router.navigate(['/admin']);
        });
      },
    });
  }

  private getMaxPlayers(): number {
    const config = getGameSizeConfig(this.selectedSize);
    return config.maxPlayers;
  }

  async onSave(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    this.gameName = this.gameName?.trim();
    this.gameDescription = this.gameDescription?.trim();

    this.isSaving = true;

    // Forcer la mise à jour du DOM avant les opérations lourdes
    await new Promise(resolve => setTimeout(resolve, 0));

    this.mapEditorService.setTitle(this.gameName);
    this.mapEditorService.setDescription(this.gameDescription);
    if (this.gameId !== '') {
      const currentGame = this.mapEditorService.getCurrentGame();
      if (!currentGame) {
        this.isSaving = false;
        return;
      }
      const previewImage = await this.gameGridComponent.captureMapPreview();
      this.mapEditorService.setImagePreview(previewImage);
      this.communicationService.updateGame(this.gameId, currentGame).subscribe({
        next: (updatedGame) => {
          this.isSaving = false;
          this.getMapEditorService().setCurrentGame(updatedGame);
          const successDialogData: DialogData = {
            title: 'Sauvegarde réussie',
            message: 'La partie a été sauvegardée.',
            type: DialogType.SUCCESS,
          };
          const dialogRef = this.dialog.open(AppDialogComponent, {
            data: successDialogData,
          });
          dialogRef.afterClosed().subscribe(() => {
            this.router.navigate(['/admin']);
          });
        },
        error: (err) => {
          this.isSaving = false;

          if (err.status === EditionPageComponent.httpNotFound) {
            const gameDeletedDialogData: DialogData = {
              title: 'Jeu supprimé',
              message: 'Ce jeu a été supprimé. Voulez-vous le recréer avec vos modifications ?',
              type: DialogType.ERROR,
            };
            this.dialog.open(AppDialogComponent, {
              data: gameDeletedDialogData,
            }).afterClosed().subscribe((result) => {
              if (result) {
                this.communicationService.createGame(currentGame).subscribe({
                  next: () => {
                    const recreateSuccessDialogData: DialogData = {
                      title: 'Succès',
                      message: 'Jeu recréé avec succès !',
                      type: DialogType.SUCCESS,
                    };
                    this.dialog.open(AppDialogComponent, {
                      data: recreateSuccessDialogData,
                    });
                    this.router.navigate(['/admin']);
                  },
                  error: (createErr) => {
                    const recreateErrorDialogData: DialogData = {
                      title: 'Erreur',
                      message: `Impossible de recréer le jeu: ${createErr.error?.message || 'Erreur inconnue'}`,
                      type: DialogType.ERROR,
                    };
                    this.dialog.open(AppDialogComponent, {
                      data: recreateErrorDialogData,
                    });
                  },
                });
              } else {
                this.router.navigate(['/admin']);
              }
            });
          } else {
            const errorMessage = Array.isArray(err.error.message)
              ? err.error.message
              : err.error.message || err.error || 'Une erreur est survenue lors de la sauvegarde de la partie.';

            const updateErrorDialogData: DialogData = {
              title: 'Erreur',
              message: errorMessage,
              type: DialogType.ERROR,
            };
            this.dialog.open(AppDialogComponent, {
              data: updateErrorDialogData,
            });
          }
        },
      });
    } else {
      const grid = this.gameGridComponent.gameMap.grid;
      const tiles = grid.map(row =>
        row.map(tile => {
          const tileData: TileData = { type: tile.type };
          if (tile.object) {
            tileData.object = { type: tile.object };
          }
          return tileData;
        }),
      );
      const gameData: GameCreationData = {
        name: this.gameName,
        description: this.gameDescription,
        isVisible: false,
        numberOfPlayers: this.getMaxPlayers(),
        gameMode: this.gameMode,
        previewImage: await this.gameGridComponent.captureMapPreview(),
        mapConfig: {
          size: this.selectedSize,
          tiles,
        },
      };
      this.communicationService.createGame(gameData).subscribe({
        next: () => {
          this.isSaving = false;
          const createSuccessDialogData: DialogData = {
            title: 'Succès',
            message: 'Jeu créé avec succès !',
            type: DialogType.SUCCESS,
          };
          const dialogRef = this.dialog.open(AppDialogComponent, {
            data: createSuccessDialogData,
          });
          dialogRef.afterClosed().subscribe(() => {
            this.router.navigate(['/admin']);
          });
        },
        error: (err) => {
          this.isSaving = false;
          const errorMessage = Array.isArray(err.error.message)
            ? err.error.message
            : err.error.message || err.error || 'Une erreur est survenue lors de la création de la partie.';

          const createErrorDialogData: DialogData = {
            title: 'Erreur',
            message: errorMessage,
            type: DialogType.ERROR,
          };
          this.dialog.open(AppDialogComponent, {
            data: createErrorDialogData,
          });
        },
      });
    }
  }

  onReset(): void {
    if (this.gameId !== '') {
      this.loadGame();
    } else {
      this.gameName = '';
      this.gameDescription = '';
      if (this.gameGridComponent) {
        this.gameGridComponent.resetGrid();
      }
    }
  }
}
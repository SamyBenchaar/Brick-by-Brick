import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
// import { Tile } from '@app/classes/tile';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/game-edition-components/object-sidebar/object-sidebar.component';
import { TextInputComponent } from '@app/components/game-edition-components/text-input/text-input.component';
import { TileTypeSidebarComponent } from '@app/components/game-edition-components/tile-type-sidebar/tile-type-sidebar.component';
import { CommunicationService } from '@app/services/communication/communication.service';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { MapSize } from '@common/map';

@Component({
  selector: 'app-edition-page',
  imports: [GameGridComponent, TileTypeSidebarComponent, ObjectSidebarComponent, TextInputComponent, RouterLink],
  templateUrl: './edition-page.component.html',
  styleUrl: './edition-page.component.scss',
})
export class EditionPageComponent implements OnInit {
  private static readonly mediumMaxPlayers = 4;
  private static readonly largeMaxPlayers = 6;
  private static readonly httpNotFound = 404;
  @ViewChild(GameGridComponent) gameGridComponent!: GameGridComponent;
  selectedSize: 'Small' | 'Medium' | 'Large' = 'Small';
  gridDimensions = { width: MapSize.Small, height: MapSize.Small }; // Valeur par défaut
  gameName: string = '';
  gameDescription: string = '';
  imagePreview: string = '';
  gameId: string = '';
  gameMode: 'classic' | 'ctf' = 'classic';
  isSaving: boolean = false;

  private route = inject(ActivatedRoute);
  private communicationService = inject(CommunicationService);
  private mapEditorService = inject(MapEditorServiceService);
  private objectCounterService = inject(ObjectCounterService);
  private router = inject(Router);
  private dialog = inject(MatDialog);

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

  getObjectCounterService(): ObjectCounterService {
    return this.objectCounterService;
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
    this.communicationService.getGameById(this.gameId).subscribe({
      next: (game) => {
        if (game) {
          this.selectedSize = game.mapConfig.size as 'Small' | 'Medium' | 'Large';
          this.getObjectCounterService().startPoint = this.getMaxPlayers();
          this.getMapEditorService().setCurrentGame(game);
          this.gameName = game.name;
          this.gameDescription = game.description;
        }
      },
      error: () => {
        this.dialog.open(AppDialogComponent, {
          data: {
            title: 'Jeu introuvable',
            message: 'Le jeu demandé n\'existe pas ou a été supprimé.',
            type: 'error',
          },
        }).afterClosed().subscribe(() => {
          this.router.navigate(['/admin']);
        });
      },
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
    if (this.isSaving) {
      return;
    }

    this.gameName = this.gameName?.trim();
    this.gameDescription = this.gameDescription?.trim();

    this.isSaving = true;

    // Forcer la mise à jour du DOM avant les opérations lourdes
    await new Promise(resolve => setTimeout(resolve, 0));

    this.getMapEditorService().setTitle(this.gameName);
    this.getMapEditorService().setDescription(this.gameDescription);
    if (this.gameId !== '') {
      const currentGame = this.getMapEditorService().getCurrentGame();
      if (!currentGame) {
        this.isSaving = false;
        return;
      }
      const previewImage = await this.gameGridComponent.captureMapPreview();
      this.getMapEditorService().setImagePreview(previewImage);
      this.communicationService.updateGame(this.gameId, currentGame).subscribe({
        next: (updatedGame) => {
          this.isSaving = false;
          this.getMapEditorService().setCurrentGame(updatedGame);
          const dialogRef = this.dialog.open(AppDialogComponent, {
            data: {
              title: 'Sauvegarde réussie',
              message: 'La partie a été sauvegardée.',
              type: 'success',
            },
          });
          dialogRef.afterClosed().subscribe(() => {
            this.router.navigate(['/admin']);
          });
        },
        error: (err) => {
          this.isSaving = false;

          if (err.status === EditionPageComponent.httpNotFound) {
            this.dialog.open(AppDialogComponent, {
              data: {
                title: 'Jeu supprimé',
                message: 'Ce jeu a été supprimé. Voulez-vous le recréer avec vos modifications ?',
                type: 'error',
              },
            }).afterClosed().subscribe((result) => {
              if (result) {
                this.communicationService.createGame(currentGame).subscribe({
                  next: () => {
                    this.dialog.open(AppDialogComponent, {
                      data: {
                        title: 'Succès',
                        message: 'Jeu recréé avec succès !',
                        type: 'success',
                      },
                    });
                    this.router.navigate(['/admin']);
                  },
                  error: (createErr) => {
                    this.dialog.open(AppDialogComponent, {
                      data: {
                        title: 'Erreur',
                        message: `Impossible de recréer le jeu: ${createErr.error?.message || 'Erreur inconnue'}`,
                        type: 'error',
                      },
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

            this.dialog.open(AppDialogComponent, {
              data: {
                title: 'Erreur',
                message: errorMessage,
                type: 'error',
              },
            });
          }
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
          this.isSaving = false;
          const dialogRef = this.dialog.open(AppDialogComponent, {
            data: {
              title: 'Succès',
              message: 'Jeu créé avec succès !',
              type: 'success',
            },
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

          this.dialog.open(AppDialogComponent, {
            data: {
              title: 'Erreur',
              message: errorMessage,
              type: 'error',
            },
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
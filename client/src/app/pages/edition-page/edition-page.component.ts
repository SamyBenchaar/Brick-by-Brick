import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
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
  selectedSize: 'small' | 'medium' | 'large' | null = null;
  gridDimensions = { width: MapSize.Small, height: MapSize.Small }; // Valeur par défaut
  gameName: string = '';
  gameDescription: string = '';
  gameId: string = '';

  constructor(
    private route: ActivatedRoute,
    private communicationService: CommunicationService,
    private mapEditorService: MapEditorServiceService,
    private router: Router,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.gameId = params.get('game_id') || '';
      if (this.gameId) {
        this.loadGame();
      }
    });

    this.route.queryParams.subscribe(params => {
      this.selectedSize = params.size || null;
    });

  }

  getMapEditorService(): MapEditorServiceService {
    return this.mapEditorService;
  }

  getMapSize(): MapSize {
    switch (this.selectedSize) {
      case 'small':
        return MapSize.Small;
      case 'medium':
        return MapSize.Medium;
      case 'large':
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


  onSave(): void {
    const currentGame = this.mapEditorService.getCurrentGame();
    this.communicationService.updateGame(this.gameId, currentGame).subscribe({
      next: (updatedGame) => {
        this.mapEditorService.setCurrentGame(updatedGame);
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
        this.dialog.open(AppDialogComponent, {
          data: {
            title: 'Erreur',
            message: err.error.message || 'Une erreur est survenue lors de la sauvegarde de la partie.',
            type: 'error',
          },
        });
      },
    });
  }

  onReset(): void {
    const currentGame = this.mapEditorService.getCurrentGame();
    if (currentGame) {
      this.gameName = currentGame.name;
      this.gameDescription = currentGame.description;
    }
  }
}
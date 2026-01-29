import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/game-edition-components/object-sidebar/object-sidebar.component';
import { TextInputComponent } from '@app/components/game-edition-components/text-input/text-input.component';
import { TileTypeSidebarComponent } from '@app/components/game-edition-components/tile-type-sidebar/tile-type-sidebar.component';
import { CommunicationService } from '@app/services/communication/communication.service';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';

@Component({
  selector: 'app-edition-page',
  imports: [GameGridComponent, TileTypeSidebarComponent, ObjectSidebarComponent, TextInputComponent],
  templateUrl: './edition-page.component.html',
  styleUrl: './edition-page.component.scss',
})
export class EditionPageComponent implements OnInit {
  gameName: string = '';
  gameDescription: string = '';
  gameId: string = '';

  constructor(
    private route: ActivatedRoute,
    private communicationService: CommunicationService,
    private mapEditorService: MapEditorServiceService,
  ) {}

  ngOnInit(): void {
    this.gameId = this.route.snapshot.paramMap.get('game_id') || '';
    if (this.gameId) {
      this.loadGame();
    }
  }

  getMapEditorService(): MapEditorServiceService {
    return this.mapEditorService;
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
    console.log("VALEUR DE MON GAME DATA", this.mapEditorService.getCurrentGame());
    this.communicationService.updateGame(this.gameId, currentGame).subscribe({
      next: (updatedGame) => {
        console.log('Jeu enregistré avec succès!', updatedGame);
        this.mapEditorService.setCurrentGame(updatedGame);
      },
      error: (error) => {
        console.error('Erreur lors de la sauvegarde:', error);
      },
    });
  }

  onReset(): void {
    const currentGame = this.mapEditorService.getCurrentGame();
    if (currentGame) {
      this.gameName = currentGame.name;
      this.gameDescription = currentGame.description;
      console.log('Formulaire réinitialisé!');
    }
  }
}
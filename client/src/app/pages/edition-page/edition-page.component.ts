import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/game-edition-components/object-sidebar/object-sidebar.component';
import { TextInputComponent } from '@app/components/game-edition-components/text-input/text-input.component';
import { TileTypeSidebarComponent } from '@app/components/game-edition-components/tile-type-sidebar/tile-type-sidebar.component';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';
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
  currentGame: Game | null = null;

  constructor(
    private route: ActivatedRoute,
    private communicationService: CommunicationService,
  ) {}

  ngOnInit(): void {
    // Récupérer le paramètre 'size' depuis l'URL
    this.gameId = this.route.snapshot.paramMap.get('game_id') || '';
    if (this.gameId) {
      this.loadGame();
    }
    this.route.queryParams.subscribe(params => {
      this.selectedSize = params.size || null;
    });
    
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
        this.currentGame = game;
        this.gameName = game.name;
        this.gameDescription = game.description;
      }
    });
  }
}

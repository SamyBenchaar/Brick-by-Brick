import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameGridComponent } from '@app/components/game-edition-components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/game-edition-components/object-sidebar/object-sidebar.component';
import { TextInputComponent } from '@app/components/game-edition-components/text-input/text-input.component';
import { TileTypeSidebarComponent } from '@app/components/game-edition-components/tile-type-sidebar/tile-type-sidebar.component';
import { Game } from '@app/interfaces/game';
import { CommunicationService } from '@app/services/communication/communication.service';

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
  currentGame: Game | null = null;

  constructor(
    private route: ActivatedRoute,
    private communicationService: CommunicationService
  ) {}

  ngOnInit(): void {
    this.gameId = this.route.snapshot.paramMap.get('game_id') || '';
    if (this.gameId) {
      this.loadGame();
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

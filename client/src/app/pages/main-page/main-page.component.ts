import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerBoardComponent } from '@app/components/game-view-components/player-board/player-board/player-board.component';

@Component({
    selector: 'app-main-page',
    templateUrl: './main-page.component.html',
    styleUrls: ['./main-page.component.scss'],
    imports: [RouterLink, PlayerBoardComponent],
})
export class MainPageComponent {
}

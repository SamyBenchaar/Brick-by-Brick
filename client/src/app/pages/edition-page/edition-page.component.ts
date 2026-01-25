import { Component } from '@angular/core';
import { GameGridComponent } from '@app/components/game-grid/game-grid.component';
import { TileTypeSidebarComponent } from '@app/components/tile-type-sidebar/tile-type-sidebar.component';
import { ObjectSidebarComponent } from '@app/components/object-sidebar/object-sidebar.component';

@Component({
  selector: 'app-edition-page',
  imports: [GameGridComponent, TileTypeSidebarComponent, ObjectSidebarComponent],
  templateUrl: './edition-page.component.html',
  styleUrl: './edition-page.component.scss',
})
export class EditionPageComponent {

}

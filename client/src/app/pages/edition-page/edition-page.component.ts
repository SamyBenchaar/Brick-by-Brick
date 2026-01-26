import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GameGridComponent } from '@app/components/game-grid/game-grid.component';
import { ObjectSidebarComponent } from '@app/components/object-sidebar/object-sidebar.component';
import { TileTypeSidebarComponent } from '@app/components/tile-type-sidebar/tile-type-sidebar.component';
import { MapSize } from '@common/map';

@Component({
  selector: 'app-edition-page',
  imports: [GameGridComponent, TileTypeSidebarComponent, ObjectSidebarComponent],
  templateUrl: './edition-page.component.html',
  styleUrl: './edition-page.component.scss',
})
export class EditionPageComponent implements OnInit {
  selectedSize: 'small' | 'medium' | 'large' | null = null;
  gridDimensions = { width: 10, height: 10 }; // Valeur par défaut

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Récupérer le paramètre 'size' depuis l'URL
    this.route.queryParams.subscribe(params => {
      this.selectedSize = params['size'] || null;
      this.updateGridDimensions();
    });
  }

  private updateGridDimensions(): void {
    switch (this.selectedSize) {
      case 'small':
        this.gridDimensions = { width: 10, height: 10 };
        break;
      case 'medium':
        this.gridDimensions = { width: 15, height: 15 };
        break;
      case 'large':
        this.gridDimensions = { width: 20, height: 20 };
        break;
      default:
        this.gridDimensions = { width: 10, height: 10 }; // Par défaut
    }
    console.log('Taille sélectionnée:', this.selectedSize);
    console.log('Dimensions de la grille:', this.gridDimensions);
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
}

import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Tile } from '@app/classes/tile';
import { OBJECT_DESCRIPTIONS } from '@app/constants/object-descriptions';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { MinimumStartingPt, ObjectType } from '@common/map';

@Component({
  selector: 'app-object-sidebar',
  imports: [CommonModule],
  templateUrl: './object-sidebar.component.html',
  styleUrl: './object-sidebar.component.scss',
})
export class ObjectSidebarComponent implements OnInit {
  editableObjects = Tile.editableObjects;
  private route = inject(ActivatedRoute);
  private objectCounterService = inject(ObjectCounterService);
  private mapEditorService = inject(MapEditorServiceService);
  readonly tile = Tile;

  ngOnInit(): void {
    const size = this.route.snapshot.queryParams.size?.toLowerCase();

    switch (size) {
      case 'small':
        this.objectCounterService.startPoint = MinimumStartingPt.Small;
        break;
      case 'medium':
        this.objectCounterService.startPoint = MinimumStartingPt.Medium;
        break;
      case 'large':
        this.objectCounterService.startPoint = MinimumStartingPt.Large;
        break;
      default:
        this.objectCounterService.startPoint = MinimumStartingPt.Small;
        break;
    }
  }


  selectObject(type: ObjectType): void {
    this.mapEditorService.selectObject(type);
  }

  isSelected(type: ObjectType): boolean {
    return this.mapEditorService.getSelectedObject() === type;
  }

  isDisabled(type: ObjectType): boolean {
    return !this.objectCounterService.canPlace(type);
  }

  getObjectDescription(type: ObjectType): string {
    return OBJECT_DESCRIPTIONS[type];
  }

  getRemainingCount(object: ObjectType): number {
    return this.objectCounterService.getRemainingCount(object);
  }

  getObjectPath(object: ObjectType): string {
    return `./assets/images/${object}.png`;
  }
}

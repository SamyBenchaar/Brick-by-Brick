import { Component, inject } from '@angular/core';
import { Tile } from '@app/classes/tile';
import { ObjectType } from '@common/map';
import { CommonModule } from '@angular/common';
import { MapEditorServiceService } from '@app/services/map-editor-service.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { OBJECT_DESCRIPTIONS } from '@app/constants/object-descriptions';

@Component({
  selector: 'app-object-sidebar',
  imports: [CommonModule],
  templateUrl: './object-sidebar.component.html',
  styleUrl: './object-sidebar.component.scss',
})
export class ObjectSidebarComponent {
  editableObjects = Tile.editableObjects;

  private objectCounterService = inject(ObjectCounterService);
  private mapEditorService = inject(MapEditorServiceService);
  readonly tile = Tile;

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
}

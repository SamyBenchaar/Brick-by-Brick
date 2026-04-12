import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Tile } from '@app/classes/tile/tile';
import { OBJECT_DESCRIPTIONS } from '@app/constants/object-descriptions';
import { MapEditorService } from '@app/services/map-editor/map-editor.service';
import { ObjectCounterService } from '@app/services/object-counter/object-counter.service';
import { getGameSizeConfig } from '@app/utils/game-config.utils';
import { GameModeValue } from '@common/constants/game-config-constants';
import { ObjectType } from '@common/map';

@Component({
  selector: 'app-object-sidebar',
  imports: [CommonModule],
  templateUrl: './object-sidebar.component.html',
  styleUrl: './object-sidebar.component.scss',
})
export class ObjectSidebarComponent implements OnInit {
  @Input() gameMode: GameModeValue = 'classic';
  editableObjects = Tile.editableObjects;
  private route = inject(ActivatedRoute);
  private objectCounterService = inject(ObjectCounterService);
  private mapEditorService = inject(MapEditorService);
  readonly tile = Tile;

  ngOnInit(): void {
    const size = this.route.snapshot.queryParams.size;
    const config = getGameSizeConfig(size);
    this.objectCounterService.startPoint = config.maxPlayers;
    this.objectCounterService.healingSanctuary = 2 ** ((config.maxPlayers - 2) / 2);
    this.objectCounterService.combatSanctuary = 2 ** ((config.maxPlayers - 2) / 2);
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

  shouldShowObject(type: ObjectType): boolean {
    if (type === ObjectType.Flag) {
      const game = this.mapEditorService.getCurrentGame();
      const currentMode = game?.gameMode || this.gameMode;
      return currentMode === 'ctf';
    }
    return true;
  }
}

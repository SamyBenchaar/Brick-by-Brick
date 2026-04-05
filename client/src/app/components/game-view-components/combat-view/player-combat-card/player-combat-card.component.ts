
import { Component, Input } from '@angular/core';
import { Character } from '@common/character';
import { COMBAT_POSTURE } from '@common/combat';
import { AVATARS } from '@app/constants/character-constants';

@Component({
  selector: 'app-player-combat-card',
  imports: [],
  templateUrl: './player-combat-card.component.html',
  styleUrl: './player-combat-card.component.scss',
})
export class PlayerCombatCardComponent {
  @Input() character: Character;

  posture: string = COMBAT_POSTURE.NONE;
  hasChosen: boolean = false;

  getAvatarPath(avatarId: number): string {
    return AVATARS[avatarId].image;
  }

}
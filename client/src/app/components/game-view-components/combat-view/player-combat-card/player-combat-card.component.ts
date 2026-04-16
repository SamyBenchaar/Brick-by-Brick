
import { Component, Input } from '@angular/core';
import { HpBarComponent } from '@app/components/hp-bar/hp-bar.component';
import { AVATARS } from '@app/constants/character-constants';
import { Character } from '@common/character';
import { CombatPosture, CombatValueDetail } from '@common/combat';

@Component({
  selector: 'app-player-combat-card',
  imports: [HpBarComponent],
  templateUrl: './player-combat-card.component.html',
  styleUrl: './player-combat-card.component.scss',
})
export class PlayerCombatCardComponent {
  @Input() character: Character;
  @Input() attackDetail: CombatValueDetail | null = null;
  @Input() defenseDetail: CombatValueDetail | null = null;
  @Input() currentHp: number;

  posture: string = CombatPosture.NONE;
  hasChosen: boolean = false;

  getAvatarPath(avatarId: number): string {
    const avatar = AVATARS.find(avatarOption => avatarOption.id === avatarId);
    return avatar ? avatar.image : './assets/images/lily.jpg';
  }

}
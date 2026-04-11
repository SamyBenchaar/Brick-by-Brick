
import { Component, Input } from '@angular/core';
import { Character } from '@common/character';
import { CombatValueDetail, COMBAT_POSTURE } from '@common/combat';
import { AVATARS } from '@app/constants/character-constants';
import { HpBarComponent } from '@app/components/hp-bar/hp-bar.component';

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

  posture: string = COMBAT_POSTURE.NONE;
  hasChosen: boolean = false;

  getAvatarPath(avatarId: number): string {
    const avatar = AVATARS.find(a => a.id === avatarId);
    return avatar ? avatar.image : './assets/images/lily.jpg';
  }

}
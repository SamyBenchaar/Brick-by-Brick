import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { AVATARS } from '@app/constants/character-constants';
import { AvatarOption } from '@app/interfaces/avatar';
import { Player } from '@common/player';

@Component({
  selector: 'app-player-sign',
  imports: [BaseSignComponent],
  templateUrl: './player-sign.component.html',
  styleUrl: './player-sign.component.scss',
})
export class PlayerSignComponent {
  @Input() player: Player | null = null;
  @Input() canAttack = false;
  @Input() selectedTargetName: string | null = null;
  @Output() attack = new EventEmitter<void>();
  readonly name = 'statistiques';
  readonly iconUrl = '';

  get avatar(): AvatarOption | undefined {
    if (!this.player) return undefined;
    return AVATARS.find(a => a.id === this.player?.character.avatarId);
  }

  onAttackClick(): void {
    if (!this.canAttack) {
      return;
    }
    this.attack.emit();
  }
}

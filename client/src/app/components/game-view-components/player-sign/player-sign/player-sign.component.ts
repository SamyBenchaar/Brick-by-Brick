import { Component, Input } from '@angular/core';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { AVATARS } from '@app/constants/character.constants';
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
  readonly name = 'statistiques';
  readonly iconUrl = '';

  get avatar(): AvatarOption | undefined {
    if (!this.player) return undefined;
    return AVATARS.find(a => a.id === this.player?.character.avatarId);
  }
}

import { Component, Input, OnInit } from '@angular/core';
import { BaseSignComponent } from '@app/components/game-view-components/base-sign/base-sign.component';
import { Character } from '@common/character';
import { AvatarOption, AVATARS } from '@app/constants/character.constants';

@Component({
  selector: 'app-player-sign',
  imports: [BaseSignComponent],
  templateUrl: './player-sign.component.html',
  styleUrl: './player-sign.component.scss',
})
export class PlayerSignComponent implements OnInit {
    @Input() player: Character | null = null;
    name: string | null;
    iconUrl: string | null;

    ngOnInit() {
      this.name = 'statistiques';
      this.iconUrl = '';
    }

    get avatar(): AvatarOption | undefined {
        if (!this.player) return undefined;
        return AVATARS.find(a => a.id === this.player?.avatarId);
    }
}

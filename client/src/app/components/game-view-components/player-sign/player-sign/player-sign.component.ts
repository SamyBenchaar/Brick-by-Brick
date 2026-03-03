import { Component, OnInit} from '@angular/core';
import { BaseSignComponent } from '../../base-sign/base-sign.component';
import { Input } from '@angular/core';
import { Character } from '@common/character';
import { AvatarOption, AVATARS,
} from '@app/constants/character.constants';
@Component({
  selector: 'app-player-sign',
  imports: [BaseSignComponent],
  templateUrl: './player-sign.component.html',
  styleUrl: './player-sign.component.scss',
})
export class PlayerSignComponent implements OnInit{
    @Input() player: Character | null = null;
    name: string| null;
    iconUrl: string| null;

    ngOnInit(){
      this.name = "statistiques";
      this.iconUrl = "rienpourLinstant";
    }

    get avatar(): AvatarOption | undefined{
     if (!this.player) return undefined;
      return AVATARS.find(a => a.id === this.player?.avatarId);
    }
}

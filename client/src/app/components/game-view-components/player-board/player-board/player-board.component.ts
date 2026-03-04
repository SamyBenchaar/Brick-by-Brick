import { Component, Input, OnInit } from '@angular/core';
import { Character } from '@common/character';
import { BaseSignComponent } from '../../base-sign/base-sign.component';

@Component({
  selector: 'app-player-board',
  imports: [BaseSignComponent],
  templateUrl: './player-board.component.html',
  styleUrl: './player-board.component.scss',
})
export class PlayerBoardComponent implements OnInit {
  @Input() players: {
    socketId: string;
    character: Character;
  }[] = [];
  @Input() host: Character | undefined = undefined;
  public actifPlayer: Character | undefined = undefined;
  name: string = "Players board";
  iconUrl: string = "blabla";

  ngOnInit(): void {
    // TODO: retirer ce bloc de test
    const c1 = new Character('Gandalf', 1, 10, 8, 6, 4, 'D6', 'D4');
    c1.id = 'socket-1';
    const c2 = new Character('Aragorn', 2, 10, 5, 7, 5, 'D6', 'D6');
    c2.id = 'socket-2';
    const c3 = new Character('Legolas', 3, 10, 9, 8, 3, 'D4', 'D6');
    c3.id = 'socket-3';
    c3.toggleActif(); // joueur actif

    this.host = c1;
    this.players = [
      { socketId: 'socket-1', character: c1 },
      { socketId: 'socket-2', character: c2 },
      { socketId: 'socket-3', character: c3 },
    ];
    // fin bloc de test

    this.actifPlayer = this.players.find(p => p.character.isActif === true)?.character;
  }
}

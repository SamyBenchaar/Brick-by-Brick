import { Dice } from '@common/dice';

export class Character {

  constructor (
    private name: string,
    private id: string,
    private avatarId: number,

    private life: number,
    private speed: number,
    private attack: number,
    private defense: number,

    private attackDice: Dice,
    private defenseDice: Dice,
  ){};

  getId(): string {
    return this.id;
  }

}

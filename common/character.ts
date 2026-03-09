import { Dice } from '@common/dice';

export class Character {
  public id: string;
  public isActif: boolean = false;
  public battlesWon: number = 0;

  constructor(
    public name: string,
    public avatarId: number,
    public maxLife: number,
    public life: number,
    public speed: number,
    public attack: number,
    public defense: number,
    public movements: number,
    public actions: number,
    public attackDice: Dice,
    public defenseDice: Dice,
  ) {};

  toggleActif(): void {
    this.isActif = !this.isActif;
  }

  addWin(): void {
    this.battlesWon++;
  }

}


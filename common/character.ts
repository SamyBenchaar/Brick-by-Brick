import { Dice } from '@common/dice';

export class Character {
  id: string;

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
  ) {}
}


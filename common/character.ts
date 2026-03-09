import { Dice } from '@common/dice';
import { Position } from '@common/gameSession';

export class Character {
  id: string;
  socketId: string;
  remainingMovement: number;

  constructor(
    public name: string,
    public avatarId: number,

    public life: number,
    public speed: number,
    public attack: number,
    public defense: number,

    public attackDice: Dice,
    public defenseDice: Dice,

    public victories: number,
    public position: Position,
    public startPosition: Position,
    public isActive: boolean,
  ) {
    this.remainingMovement = speed;
  }


  resetMovement(): void {
    this.remainingMovement = this.speed;
  }

  moveTo(position: Position): void {
    this.position = position;
  }

  addVictory(): void {
    this.victories++;
  }
}


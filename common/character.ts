import { Dice } from '@common/dice';

export interface Position {
  x: number;
  y: number;
}

export interface Character {
  id: string;
  isActif: boolean;
  battlesWon: number;
  name: string;
  avatarId: number;
  maxLife: number;
  life: number;
  speed: number;
  attack: number;
  defense: number;
  movements: number;
  actions: number;
  attackDice: Dice;
  defenseDice: Dice;
  position?: Position;
  remainingMovement?: number;
  remainingActions?: number;
  victories?: number;
  startPosition?: Position;
}


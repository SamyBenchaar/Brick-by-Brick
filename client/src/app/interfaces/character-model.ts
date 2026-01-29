export type Dice = 'D4' | 'D6';

export interface Character {
  name: string;
  avatarId: number;

  life: number;
  speed: number;
  attack: number;
  defense: number;

  attackDice: Dice;
  defenseDice: Dice;
}

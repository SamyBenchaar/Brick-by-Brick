export enum Dice {
    D4 = 'D4',
    D6 = 'D6',
}

export const DICE_FACES_MAP: Record<Dice, number> = {
  [Dice.D4]: 4,
  [Dice.D6]: 6,
};
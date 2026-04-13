import { Dice } from '@common/dice';
import { AvatarOption } from '@app/interfaces/avatar';

export const BASE_LIFE = 6;
export const BASE_SPEED = 6;
export const BASE_ATTACK = 4;
export const BASE_DEFENSE = 4;
export const BASE_ACTIONS = 1;
export const BONUS_AMOUNT = 2;
export const RANDOM_NAME_MAX = 1000;
export const DICE_PROBABILITY = 0.5;
export const DICE_VALUES: Dice[] = [Dice.D4, Dice.D6];
export const BONUS_ATTRIBUTES = ['life', 'speed'] as const;
export const AVATAR_SYNC_DELAY_MS = 100;
export const MS_CONVERSION = 1000;

export const AVATARS: AvatarOption[] = [
    { id: 1, name: 'lily', image: './assets/images/characters-png/lily.png' },
    { id: 2, name: 'lyes', image: './assets/images/characters-png/lyes.png' },
    { id: 3, name: 'avatar1', image: './assets/images/characters-png/avatar1.png' },
    { id: 4, name: 'avatar2', image: './assets/images/characters-png/avatar2.png' },
    { id: 5, name: 'avatar3', image: './assets/images/characters-png/avatar3.png' },
    { id: 6, name: 'avatar4', image: './assets/images/characters-png/avatar4.png' },
    { id: 7, name: 'avatar5', image: './assets/images/characters-png/avatar5.png' },
    { id: 8, name: 'avatar6', image: './assets/images/characters-png/avatar6.png' },
    { id: 9, name: 'avatar7', image: './assets/images/characters-png/avatar7.png' },
    { id: 10, name: 'avatar8', image: './assets/images/characters-png/avatar8.png' },
    { id: 11, name: 'avatar9', image: './assets/images/characters-png/avatar9.png' },
    { id: 12, name: 'avatar10', image: './assets/images/characters-png/avatar10.png' },
];
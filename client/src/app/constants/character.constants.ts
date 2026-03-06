import { Dice } from '@common/dice';

export const BASE_LIFE = 6;
export const BASE_SPEED = 6;
export const BASE_ATTACK = 4;
export const BASE_DEFENSE = 4;
export const BASE_ACTIONS = 1;  
export const BONUS_AMOUNT = 2;
export const RANDOM_NAME_MAX = 1000;
export const DICE_PROBABILITY = 0.5;
export const DICE_VALUES: Dice[] = ['D4', 'D6'];
export const BONUS_ATTRIBUTES = ['life', 'speed'] as const;
export const AVATAR_SYNC_DELAY_MS = 100;

export interface AvatarOption {
    id: number;
    name: string;
    image: string;
}

export const AVATARS: AvatarOption[] = [
        { id: 1, name: 'lily', image: 'assets/images/lily.jpg' },
        { id: 2, name: 'lyes', image: 'assets/images/lyes.jpg' },
        { id: 3, name: 'avatar1', image: 'assets/images/avatar1.jpg' },
        { id: 4, name: 'avatar2', image: 'assets/images/avatar2.jpg' },
        { id: 5, name: 'avatar3', image: 'assets/images/avatar3.webp' },
        { id: 6, name: 'avatar4', image: 'assets/images/avatar4.png' },
        { id: 7, name: 'avatar5', image: 'assets/images/avatar5.webp' },
        { id: 8, name: 'avatar6', image: 'assets/images/avatar6.jpg' },
        { id: 9, name: 'avatar7', image: 'assets/images/avatar7.webp' },
        { id: 10, name: 'avatar8', image: 'assets/images/avatar8.webp' },
        { id: 11, name: 'avatar9', image: 'assets/images/avatar9.jpg' },
        { id: 12, name: 'avatar10', image: 'assets/images/avatar10.png' },
    ];
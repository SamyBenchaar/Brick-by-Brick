import { GameModeDisplay } from '@common/interfaces/game-mode-display';

export type GameSizeId = 'Small' | 'Medium' | 'Large';
export type GameModeValue = 'classic' | 'ctf';

export const GAME_MODES_DISPLAY: GameModeDisplay[] = [
    { value: 'classic', label: 'Classique', disabled: false },
    { value: 'ctf', label: 'Capture du drapeau', disabled: false },
];

export const GAME_SIZES_DISPLAY = [
    {
        id: 'Small' as const,
        label: 'Petite',
        gridSize: 10,
        maxPlayers: 2,
    },
    {
        id: 'Medium' as const,
        label: 'Moyenne',
        gridSize: 15,
        maxPlayers: 4,
    },
    {
        id: 'Large' as const,
        label: 'Grande',
        gridSize: 20,
        maxPlayers: 6,
    },
];

export const VICTORIES_TO_WIN = 3;
export const ROOM_ID_LENGTH = 8;
export const MAX_PLAYER = 6;
export const CTF_VICTORY_ANNOUNCE_DELAY = 500;

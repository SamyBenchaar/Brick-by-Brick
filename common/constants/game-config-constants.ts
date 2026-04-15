import { GameModeDisplay } from '@common/interfaces/game-mode-display';

export enum GameSizeId {
    Small = 'Small',
    Medium = 'Medium',
    Large = 'Large',
}

export enum GameModeValue {
    Classic = 'classic',
    Ctf = 'ctf',
}

export const GAME_MODES_DISPLAY: GameModeDisplay[] = [
    { value: GameModeValue.Classic, label: 'Classique', disabled: false },
    { value: GameModeValue.Ctf, label: 'Capture du drapeau', disabled: false },
];

export const GAME_SIZES_DISPLAY = [
    {
        id: GameSizeId.Small,
        label: 'Petite',
        gridSize: 10,
        maxPlayers: 2,
    },
    {
        id: GameSizeId.Medium,
        label: 'Moyenne',
        gridSize: 15,
        maxPlayers: 4,
    },
    {
        id: GameSizeId.Large,
        label: 'Grande',
        gridSize: 20,
        maxPlayers: 6,
    },
];

export const VICTORIES_TO_WIN = 3;
export const ROOM_ID_LENGTH = 8;
export const MAX_PLAYER = 6;
export const CTF_VICTORY_ANNOUNCE_DELAY = 500;

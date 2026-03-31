export type GameSizeId = 'Small' | 'Medium' | 'Large';
export type GameModeValue = 'classic' | 'ctf';

export const GAME_MODES_DISPLAY = [
    { value: 'classic' as const, label: 'Classique', disabled: false },
    { value: 'ctf' as const, label: 'Capture du drapeau', disabled: false },
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

export function getGameSizeLabel(sizeId: string): string {
    return GAME_SIZES_DISPLAY.find(s => s.id === sizeId)?.label || sizeId;
}

export function getGameModeLabel(gameMode: string): string {
    return GAME_MODES_DISPLAY.find(mode => mode.value === gameMode)?.label || gameMode;
}

export function getGameSizeConfig(sizeId: string) {
    return GAME_SIZES_DISPLAY.find(s => s.id === sizeId) || GAME_SIZES_DISPLAY[0];
}

export const VICTORIES_TO_WIN = 3;
export const ROOM_ID_LENGTH = 8;
export const MAX_PLAYER = 6;

import { GAME_MODES_DISPLAY, GAME_SIZES_DISPLAY } from '@common/constants/game-config-constants';

export function getGameSizeLabel(sizeId: string): string {
    return GAME_SIZES_DISPLAY.find(s => s.id === sizeId)?.label || sizeId;
}

export function getGameModeLabel(gameMode: string): string {
    return GAME_MODES_DISPLAY.find(mode => mode.value === gameMode)?.label || gameMode;
}

export function getGameSizeConfig(sizeId: string) {
    return GAME_SIZES_DISPLAY.find(s => s.id === sizeId) || GAME_SIZES_DISPLAY[0];
}

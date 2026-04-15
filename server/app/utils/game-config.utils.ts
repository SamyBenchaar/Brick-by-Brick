import { GAME_SIZES_DISPLAY } from '@common/constants/game-config-constants';

export function getGameSizeConfig(sizeId: string) {
    return GAME_SIZES_DISPLAY.find(sizeConfig => sizeConfig.id === sizeId) || GAME_SIZES_DISPLAY[0];
}

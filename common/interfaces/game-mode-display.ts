import { GameModeValue } from '@common/constants/game-config-constants';

export interface GameModeDisplay {
    value: GameModeValue;
    label: string;
    disabled: boolean;
}
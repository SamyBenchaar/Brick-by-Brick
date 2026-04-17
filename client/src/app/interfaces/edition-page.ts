import { DialogType } from '@app/constants/dialog-type.enum';
import { GameModeValue, GameSizeId } from '@common/constants/game-config-constants';
import { MapSize } from '@common/map';

export interface GridDimensions {
    width: MapSize;
    height: MapSize;
}

export interface TileData {
    type: string;
    object?: TileObjectRef;
    isOrigin?: boolean;
}

export interface TileObjectRef {
    type: string;
}

export interface SizedGameMapConfig<TTile, TSize> {
    size: TSize;
    tiles: TTile[][];
}

export interface GameCreationData {
    name: string;
    description: string;
    isVisible: boolean;
    numberOfPlayers: number;
    gameMode: GameModeValue;
    previewImage: string;
    mapConfig: SizedGameMapConfig<TileData, GameSizeId>;
}

export interface DialogData {
    title: string;
    message: string;
    type: DialogType;
    cancelText?: string;
    confirmText?: string;
}

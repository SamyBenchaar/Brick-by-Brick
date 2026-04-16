import {MapTile} from '@app/interfaces/game-map-interfaces';
import { Injectable } from '@nestjs/common';
import { Position } from '@common/position';
import {  ADJACENT_TO_ORIGIN_POSITION, SANCTUARY_TILE_OFFSETS } from '@common/constants/santuary-constants';
import { ObjectType } from '@common/map';
import { GameSession } from '@app/domain/game-session';
import { Character } from '@common/character';
import { Tile } from '@app/model/tile';

@Injectable()
export class SanctuaryService {

    initializeSanctuaryOrigins(tiles: MapTile[][]): void {
        for (let y = 0; y < tiles.length; y++) {
            for (let x = 0; x < tiles[y].length; x++) {
                if (tiles[y][x].isOrigin) {
                    const origin: Position = { x, y };
                    SANCTUARY_TILE_OFFSETS.forEach(({ dx, dy }) => {
                        const t = tiles[y + dy]?.[x + dx];
                        if (t) t.sanctuaryOrigin = origin;
                    });
                }
            }
        }
    }

    decrementCooldowns(tiles: MapTile[][]): void {
        for (const row of tiles) {
            for (const tile of row) {
                if (tile.isOrigin && tile.sanctuaryCooldown && tile.sanctuaryCooldown > 0) {
                    tile.sanctuaryCooldown--;
                    if (tile.sanctuaryCooldown === 0) delete tile.sanctuaryCooldown;
                }
            }   
        }
    }

    canInteractWithSanctuary(position: Position, tiles: MapTile[][]): boolean {
        const tile = tiles[position.y]?.[position.x];
        if (!tile?.sanctuaryOrigin) return false;

        const originPos = tile.sanctuaryOrigin;
        const originTile = tiles[originPos.y]?.[originPos.x];

        const cooldown = originTile?.sanctuaryCooldown ?? 0;

        return cooldown === 0;
    }

}
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Tile } from '@app/classes/tile/tile';
import { AppDialogComponent } from '@app/components/game-edition-components/app-dialog/app-dialog.component';
import { AVATARS } from '@app/constants/character-constants';
import { Character } from '@common/character';
import { DoorState, MULTI_TILE_OBJECTS, ObjectType, PLAYABLE_TYPES, TILE_COST, TileType } from '@common/map';
import { Position } from '@common/position';

@Injectable({ providedIn: 'root' })
export class GameGridUtilService {
    constructor(private dialog: MatDialog) {}

    openPlayerDialog(player: Character): void {
        this.dialog.open(AppDialogComponent, {
            data: {
                title: 'Informations du joueur',
                message: `Joueur: ${player.name}\nAvatar ID: ${player.avatarId}\nVictoires: ${player.victories}`,
                image: this.getAvatarImage(player.avatarId),
                type: 'info',
            },
        });
    }

    openTileDialog(tile: Tile): void {
        this.dialog.open(AppDialogComponent, {
            data: {
                title: 'Informations de la tuile',
                message: `Type: ${tile.type}\nCoût: ${TILE_COST[tile.type] ?? 0}`,
                type: 'info',
            },
        });
    }

    isTileValidForTeleport(tile: Tile | null, player: Character | null): boolean {
        const isEmpty = !!tile && !tile.object;
        const hasNoPlayer = !player;
        const isWalkable = tile ? PLAYABLE_TYPES.includes(tile.type) : false;
        return isEmpty && hasNoPlayer && isWalkable;
    }

    isMultiTileObject(object: ObjectType): boolean {
        return MULTI_TILE_OBJECTS.includes(object);
    }

    getObjectPath(object: ObjectType, sanctuaryCooldown?: number): string {
        const isOnCooldown=  (sanctuaryCooldown ?? 0) > 0;
        if (isOnCooldown && object === ObjectType.HealingSanctuary) return './assets/images/offhealingsanctuary.png';
        if (isOnCooldown && object === ObjectType.CombatSanctuary) return './assets/images/offcombatsanctuary.png';
        return `./assets/images/${object}.png`;
    }

    getTilePath(tile: TileType, doorState?: DoorState): string {
        return tile === TileType.Door ? `./assets/images/${doorState}-door.jpg` : `./assets/images/${tile}.jpg`;
    }

    getPlayerTeamClass(player: Character, gameMode: string): string {
        return gameMode !== 'ctf' || !player.team ? '' : `player-team-${player.team}`;
    }

    getAvatarImage(avatarId: number): string {
        return AVATARS.find(a => a.id === avatarId)?.image ?? 'assets/images/lily.jpg';
    }

    isSanctuaryOriginTile(tile: Tile, position: Position): boolean {
        return tile.sanctuaryOrigin?.x === position.x && tile.sanctuaryOrigin?.y === position.y;
    }

    isTileObjectFree(tile: Tile): boolean {
        return !tile?.object;
    }

    isFlagVisible(tile: Tile, gameMode: string, flagPosition: Position | null, flagHolderId: string | null): boolean {
        if (gameMode !== 'ctf') return true;
        if (tile.object?.toString() !== ObjectType.Flag.toString()) return true;
        if (flagPosition) return false;
        return !flagHolderId;
    }

    isFlagAtPosition(position: Position, gameMode: string, flagHolderId: string | null, flagPosition: Position | null): boolean {
        if (gameMode !== 'ctf') return false;
        if (flagHolderId) return false;
        if (!flagPosition) return false;
        return flagPosition.x === position.x && flagPosition.y === position.y;
    }
}

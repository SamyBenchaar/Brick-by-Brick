import { Injectable } from '@angular/core';
import { Tile } from '@app/classes/tile/tile';
import { Game } from '@app/interfaces/game';
import { InteractionContext } from '@app/interfaces/game-play';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import {
    ADJACENT_POSITIONS,
    ADJACENT_TO_ORIGIN_POSITION,
    ORIGIN_CANDIDATES,
    SANCTUARY_TILE_OFFSETS,
} from '@common/constants/santuary-constants';
import { ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';

@Injectable({
    providedIn: 'root',
})
export class InteractionActionRulesService {
    canInteractWithTarget(
        context: InteractionContext,
        targetTile: Tile,
        targetPosition: Position,
    ): boolean {
        const { session, currentPlayer, canAct, mapCopy } = context;
        const playerPosition = currentPlayer?.position;
        if (!playerPosition || !canAct) {
            return false;
        }

        if (targetTile.type === TileType.Door) {
            return this.areAdjacent(playerPosition, targetPosition)
                && !this.isFlagOnPosition(session, targetPosition);
        }

        const targetObjectType = targetTile.object;
        if (
            targetObjectType === ObjectType.HealingSanctuary
            || targetObjectType === ObjectType.CombatSanctuary
        ) {
            return this.canInteractWithSanctuary(currentPlayer, playerPosition, targetPosition, targetObjectType, mapCopy);
        }

        return false;
    }

    canPlayerInteractDoor(
        session: GameSession | null,
        currentPlayer: Character | null,
        canAct: boolean,
        mapCopy: Game | null,
    ): boolean {
        if (!currentPlayer?.position || !canAct || !mapCopy) {
            return false;
        }

        if (session?.flagPosition && this.areAdjacent(currentPlayer.position, session.flagPosition)) {
            return false;
        }

        const { x, y } = currentPlayer.position;

        return ADJACENT_POSITIONS.some((offset) => {
            const adjacentTile = mapCopy.mapConfig.tiles[y + offset.y]?.[x + offset.x];
            return adjacentTile?.type === TileType.Door;
        });
    }

    canPlayerInteractSanctuary(
        currentPlayer: Character | null,
        canAct: boolean,
        mapCopy: Game | null,
    ): boolean {
        if (!currentPlayer?.position || !canAct || !mapCopy) {
            return false;
        }

        const hasCombatBonus = !!currentPlayer.combatSanctuaryBonus;
        const { x, y } = currentPlayer.position;

        return ADJACENT_POSITIONS.some((offset) => {
            const tileX = x + offset.x;
            const tileY = y + offset.y;
            const tile = mapCopy.mapConfig.tiles[tileY]?.[tileX];

            if (!this.isSanctuary(tile?.object?.type) || hasCombatBonus) {
                return false;
            }

            const sanctuaryOrigin = this.findSanctuaryOrigin({ x: tileX, y: tileY }, mapCopy);
            if (!sanctuaryOrigin) {
                return false;
            }

            const originTile = mapCopy.mapConfig.tiles[sanctuaryOrigin.y]?.[sanctuaryOrigin.x];
            return (originTile?.sanctuaryCooldown ?? 0) === 0;
        });
    }

    private isSanctuary(objectType: string | undefined): boolean {
        return objectType === ObjectType.HealingSanctuary
            || objectType === ObjectType.CombatSanctuary;
    }

    private isFlagOnPosition(session: GameSession | null, position: Position): boolean {
        return session?.flagPosition?.x === position.x && session?.flagPosition?.y === position.y;
    }

    private findSanctuaryOrigin(position: Position, mapCopy: Game | null): Position | undefined {
        const tiles = mapCopy?.mapConfig.tiles;
        if (!tiles) {
            return undefined;
        }

        return ORIGIN_CANDIDATES
            .map(({ dx, dy }) => ({ x: position.x + dx, y: position.y + dy }))
            .find((candidate) =>
                SANCTUARY_TILE_OFFSETS.every(({ dx, dy }) => {
                    const candidateTile = tiles[candidate.y + dy]?.[candidate.x + dx];
                    const objectType = candidateTile?.object?.type;

                    return objectType === ObjectType.HealingSanctuary
                        || objectType === ObjectType.CombatSanctuary;
                }),
            );
    }

    private canInteractWithSanctuary(
        currentPlayer: Character,
        playerPosition: Position,
        sanctuaryTilePosition: Position,
        sanctuaryObjectType: string | undefined,
        mapCopy: Game | null,
    ): boolean {
        if (!mapCopy) {
            return false;
        }

        if (
            currentPlayer.combatSanctuaryBonus
            && sanctuaryObjectType === ObjectType.CombatSanctuary
        ) {
            return false;
        }

        const originPosition = this.findSanctuaryOrigin(sanctuaryTilePosition, mapCopy);
        if (!originPosition) {
            return false;
        }

        const originTile = mapCopy.mapConfig.tiles[originPosition.y]?.[originPosition.x];
        if ((originTile?.sanctuaryCooldown ?? 0) > 0) {
            return false;
        }

        return ADJACENT_TO_ORIGIN_POSITION.some(([dx, dy]) =>
            this.areAdjacent(playerPosition, { x: originPosition.x + dx, y: originPosition.y + dy }),
        );
    }

    private areAdjacent(positionA: Position, positionB: Position): boolean {
        return Math.abs(positionA.x - positionB.x) + Math.abs(positionA.y - positionB.y) === 1;
    }
}

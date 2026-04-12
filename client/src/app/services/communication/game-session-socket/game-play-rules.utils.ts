import { Tile } from '@app/classes/tile/tile';
import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { ADJACENT_POSITIONS, ADJACENT_TO_ORIGIN_POSITION, ORIGIN_CANDIDATES, SANCTUARY_TILE_OFFSETS } from '@common/constants/santuary-constants';
import { ObjectType, TileType } from '@common/map';
import { Position } from '@common/position';

export function areAdjacent(positionA: Position, positionB: Position): boolean {
    return Math.abs(positionA.x - positionB.x) + Math.abs(positionA.y - positionB.y) === 1;
}

export function isFlagOnPosition(position: Position, gameSession: GameSession | null): boolean {
    return gameSession?.flagPosition?.x === position.x && gameSession?.flagPosition?.y === position.y;
}

export function findSanctuaryOrigin(position: Position, mapCopy: Game | null): Position | undefined {
    const tiles = mapCopy?.mapConfig.tiles;
    if (!tiles) return undefined;

    return ORIGIN_CANDIDATES
        .map(({ dx, dy }) => ({ x: position.x + dx, y: position.y + dy }))
        .find(candidate =>
            SANCTUARY_TILE_OFFSETS.every(({ dx, dy }) => {
                const t = tiles[candidate.y + dy]?.[candidate.x + dx];
                return t?.object?.type === ObjectType.HealingSanctuary || t?.object?.type === ObjectType.CombatSanctuary;
            }),
        );
}

export function isSanctuary(object: string | undefined): boolean {
    return object === ObjectType.HealingSanctuary || object === ObjectType.CombatSanctuary;
}

export function canInteractWithSanctuary(
    player: Character,
    playerPosition: Position,
    target: Tile,
    position: Position,
    mapCopy: Game | null,
): boolean {
    if (player.combatSanctuaryBonus !== undefined && target.object === ObjectType.CombatSanctuary) return false;

    const originPos = findSanctuaryOrigin(position, mapCopy);
    if (!originPos) return false;

    const originTile = mapCopy?.mapConfig.tiles[originPos.y]?.[originPos.x];
    if ((originTile?.sanctuaryCooldown ?? 0) > 0) return false;

    return ADJACENT_TO_ORIGIN_POSITION.some(([dx, dy]) =>
        areAdjacent(playerPosition, { x: originPos.x + dx, y: originPos.y + dy }),
    );
}

export function canInteractWithTarget(
    inCombat: boolean,
    isMyTurn: boolean,
    currentPlayer: Character | null,
    target: Tile,
    position: Position,
    mapCopy: Game | null,
    gameSession: GameSession | null,
): boolean {
    if (inCombat) return false;

    const playerPosition = currentPlayer?.position;
    if (!isMyTurn || !playerPosition || (currentPlayer.remainingActions ?? 0) <= 0) return false;

    if (target.type === TileType.Door) {
        return areAdjacent(playerPosition, position) && !isFlagOnPosition(position, gameSession);
    }

    if (target.object === ObjectType.HealingSanctuary || target.object === ObjectType.CombatSanctuary) {
        return canInteractWithSanctuary(currentPlayer, playerPosition, target, position, mapCopy);
    }

    return false;
}

export function canPlayerInteractSanctuary(
    inCombat: boolean,
    isMyTurn: boolean,
    currentPlayer: Character | null,
    mapCopy: Game | null,
): boolean {
    if (inCombat) return false;

    const hasBonus = currentPlayer?.combatSanctuaryBonus !== undefined;
    if (!isMyTurn || !currentPlayer?.position || (currentPlayer.remainingActions ?? 0) <= 0) return false;
    if (!mapCopy) return false;

    const { x, y } = currentPlayer.position;
    return ADJACENT_POSITIONS.some(offset => {
        const tileX = x + offset.x;
        const tileY = y + offset.y;
        const tile = mapCopy.mapConfig.tiles[tileY]?.[tileX];
        const sanctuary = isSanctuary(tile?.object?.type);

        if (hasBonus && sanctuary) return false;
        if (!sanctuary) return false;

        const originPos = findSanctuaryOrigin({ x: tileX, y: tileY }, mapCopy);
        if (!originPos) return false;

        return (mapCopy.mapConfig.tiles[originPos.y]?.[originPos.x]?.sanctuaryCooldown ?? 0) === 0;
    });
}

export function canPlayerInteractDoor(
    inCombat: boolean,
    isMyTurn: boolean,
    currentPlayer: Character | null,
    mapCopy: Game | null,
    gameSession: GameSession | null,
): boolean {
    if (inCombat) return false;
    if (!isMyTurn || !currentPlayer?.position || (currentPlayer.remainingActions ?? 0) <= 0) return false;
    if (!mapCopy) return false;

    if (areAdjacent(currentPlayer.position, {
        x: gameSession?.flagPosition?.x ?? 0,
        y: gameSession?.flagPosition?.y ?? 0,
    })) {
        return false;
    }

    const { x, y } = currentPlayer.position;
    return ADJACENT_POSITIONS.some(offset => mapCopy.mapConfig.tiles[y + offset.y]?.[x + offset.x]?.type === 'door');
}

export function canAttackTarget(
    inCombat: boolean,
    isMyTurn: boolean,
    currentPlayer: Character | null,
    target: Character | null,
): boolean {
    if (inCombat) return false;
    if (!isMyTurn) return false;
    if (!currentPlayer?.position || !target?.position) return false;
    if (target.id === currentPlayer.id) return false;
    if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

    return areAdjacent(currentPlayer.position, target.position);
}

export function canCurrentPlayerAttack(
    inCombat: boolean,
    isMyTurn: boolean,
    currentPlayer: Character | null,
    hasAutoAttackTarget: boolean,
): boolean {
    if (inCombat) return false;
    if (!isMyTurn) return false;
    if (!currentPlayer?.position) return false;
    if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

    return hasAutoAttackTarget;
}

export function isValidFlagTransferTarget(currentPlayer: Character, target: Character): boolean {
    if (!currentPlayer.position || !target.position) return false;
    if (target.id === currentPlayer.id) return false;
    if (currentPlayer.team !== target.team) return false;
    if ((currentPlayer.remainingActions ?? 0) <= 0) return false;

    const distance = Math.abs(currentPlayer.position.x - target.position.x) + Math.abs(currentPlayer.position.y - target.position.y);
    return distance === 1;
}

export function canTransferFlagTo(
    inCombat: boolean,
    gameMode: string | undefined,
    isMyTurn: boolean,
    currentPlayer: Character | null,
    target: Character | null,
): boolean {
    if (inCombat) return false;
    if (gameMode !== 'ctf') return false;
    if (!target || !currentPlayer) return false;

    const canTransfer = (
        currentPlayer.hasFlag === true && target.hasFlag === false
    ) || (
            currentPlayer.hasFlag === false && target.hasFlag === true
        );

    return canTransfer && isMyTurn && isValidFlagTransferTarget(currentPlayer, target);
}

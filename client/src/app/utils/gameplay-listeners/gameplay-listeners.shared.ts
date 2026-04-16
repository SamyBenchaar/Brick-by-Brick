import { Tile } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { GameEndedPayload } from '@app/interfaces/game-play';
import { GameModeValue } from '@common/constants/game-config-constants';
import {
    ORIGIN_CANDIDATES,
    SANCTUARY_TILE_OFFSETS,
} from '@common/constants/santuary-constants';
import { ObjectType, TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { GameStatisticsNavigationState } from '@app/interfaces/gameplay-listeners';

const WALKABLE_TILE_TYPES = new Set<string>([TileType.Base, TileType.Water, TileType.Ice]);

export function findSanctuaryOrigin(position: Position, tiles: Tile[][]): Position | undefined {
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

export function buildGameEndedMessage(
    data: GameEndedPayload,
    socketId: string,
): { title: string; message: string } {
    let title = 'Partie terminée';
    let message = 'La partie est terminée.';

    if (data.reason === 'victory' && data.winner) {
        if (data.gameMode === GameModeValue.Ctf && data.winningTeam) {
            const teamName = data.winningTeam === 'team1' ? 'bleue' : 'rouge';
            title = 'Victoire!';
            message = `L'équipe ${teamName} a gagné la partie!`;
            return { title, message };
        }

        if (data.winner.id === socketId) {
            title = 'Victoire!';
            message = 'Félicitations! Vous avez gagné la partie avec 3 victoires!';
            return { title, message };
        }

        message = `${data.winner.name} a gagné la partie avec 3 victoires!`;
        return { title, message };
    }

    if (data.reason === 'noPlayers') {
        message = 'La partie est terminée car tous les autres joueurs ont abandonné.';
        return { title, message };
    }

    if (data.reason === 'canceled') {
        title = 'Partie annulée';
        message = "La partie a été annulée car une équipe n'a plus aucun joueur.";
        return { title, message };
    }

    return { title, message };
}

export function buildStatisticsNavigationState(
    data: GameEndedPayload,
    session: GameSession | null,
    gamePlaySocketService: GamePlaySocketService,
): GameStatisticsNavigationState {
    const socketId = gamePlaySocketService.getSocketId();
    const walkableTiles = countWalkableTiles(gamePlaySocketService.mapCopy()?.mapConfig.tiles);

    return {
        players: buildPlayersList(data, session),
        winner: data.winner,
        winningTeam: data.winningTeam,
        gameMode: data.gameMode,
        walkableTiles,
        gameId: session?.roomId,
        username: buildUsername(session, socketId),
        hostPlayerId: buildHostPlayerId(session),
        ...buildGameStatistics(data),
    };
}

function countWalkableTiles(tiles: Tile[][] | undefined): number | undefined {
    if (!tiles) {
        return undefined;
    }

    return tiles.flat().filter((tile) => WALKABLE_TILE_TYPES.has(tile.type)).length;
}

function buildPlayersList(data: GameEndedPayload, session: GameSession | null): Player[] {
    const currentPlayers = data.players ?? session?.players ?? [];
    const leftPlayers = session?.leftPlayers ?? [];

    return [...currentPlayers, ...leftPlayers];
}

function buildUsername(session: GameSession | null, socketId: string): string {
    if (!session) {
        return '';
    }

    return session.players.find((player: Player) => player.socketId === socketId)?.character.name ?? '';
}

function buildHostPlayerId(session: GameSession | null): string {
    return session?.host?.socketId ?? '';
}

function buildGameStatistics(data: GameEndedPayload): Pick<
    GameStatisticsNavigationState,
    'durationSeconds' | 'totalTurns' | 'sanctuariesUsedPercent' | 'tilesVisitedPercent' | 'doorsUsedPercent' | 'flagHoldersCount'
> {
    return {
        durationSeconds: data.durationSeconds ?? 0,
        totalTurns: data.totalTurns ?? 0,
        sanctuariesUsedPercent: data.sanctuariesUsedPercent ?? null,
        tilesVisitedPercent: data.tilesVisitedPercent ?? 0,
        doorsUsedPercent: data.doorsUsedPercent ?? null,
        flagHoldersCount: data.flagHoldersCount ?? null,
    };
}

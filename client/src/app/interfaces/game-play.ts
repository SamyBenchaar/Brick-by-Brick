import { Game } from '@app/interfaces/game';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { Player } from '@common/player';
import { Position } from '@common/position';
export { CombatPosture } from '@common/combat';

export { InteractionMode } from '@app/constants/game-play.constants';
export { TeamId as WinningTeam } from '@common/team';

export interface PendingFlagTransferEntry {
    targetPlayerId: string;
    createdAt: number;
}

export interface InteractionContext {
    session: GameSession | null;
    currentPlayer: Character | null;
    canAct: boolean;
    mapCopy: Game | null;
}

export interface WinnerSummary {
    id: string;
    name: string;
    avatarId: number;
}

import { TeamId as WinningTeam } from '@common/team';

export interface GameEndedPayload {
    winner: WinnerSummary | null;
    winningTeam?: WinningTeam;
    gameMode?: string;
    reason: string;
    players?: Player[];
    durationSeconds?: number;
    totalTurns?: number;
    sanctuariesUsedPercent?: number | null;
    tilesVisitedPercent?: number | null;
    doorsUsedPercent?: number | null;
    flagHoldersCount?: number | null;
}

export interface ReachableTilesPayload {
    playerId: string;
    tiles: Position[];
}

export interface TurnStartingPayload {
    playerId: string;
    playerName: string;
    delay: number;
}

export interface TurnStartedPayload {
    playerId: string;
    playerName: string;
    turnTime: number;
    remainingMovement?: number;
    remainingActions?: number;
}

export interface MoveExecutedPayload {
    playerId: string;
    position: Position;
    remainingMovement: number;
    remainingActions: number;
}

export interface ToggleDebugModePayload {
    isDebugModeActivated: boolean;
}

export interface FlagTransferRequestPayload {
    fromPlayerId: string;
    fromPlayerName: string;
}

export interface InteractResultPayload {
    position: Position;
    newDoorState: string;
    remainingActions: number;
    interactionType: string;
    newLife?: number;
    newAttack?: number;
    newDefense?: number;
}

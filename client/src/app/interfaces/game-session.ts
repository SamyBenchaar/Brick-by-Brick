import { ActiveCombat } from '@common/combat';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { SessionStatus } from '@common/session.status';
import { Game } from './game';

import { TeamId } from '@common/team';

export interface GameSession {
    players: Player[];
    leftPlayers: Player[];
    status: SessionStatus;
    roomId: string;
    maxPlayers: number;
    mapCopy: Game | null;
    host: Player;
    mapId: string;
    socketToAvatar: Map<string, number>;
    playerOrder: string[];
    currentPlayerIndex: number;
    currentTurnTime: number;
    startingPoints: Map<string, Position>;
    isTurnStarting: boolean;
    isDebugModeActivated: boolean;
    gameMode: string;
    playerTeams?: Map<string, TeamId>;
    flagPosition?: Position | null;
    flagHolderId?: string | null;
    activeCombat?: ActiveCombat | null;
    currentCombatTurnTime?: number;
}

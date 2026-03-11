import { Player } from "@common/player"
import { SessionStatus } from "@common/session.status"

export interface GameSession {
    players: Player[];
    leftPlayers: Player[];
    status: SessionStatus;
    roomId: string;
    maxPlayers: number;
    mapCopy: null;
    host: Player;
    mapId: string;
    socketToAvatar: Map<string, number>;
}

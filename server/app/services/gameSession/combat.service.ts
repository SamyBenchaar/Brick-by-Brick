import { Character } from '@common/character';
import { GameSession, Position } from '@app/domain/game-session';
import { Injectable, Logger } from '@nestjs/common';
import { StartingPointService } from './starting-point.service';

interface MapTile {
    type: string;
    object?: { type: string };
}

interface GameMap {
    tiles: MapTile[][];
}

@Injectable()
export class CombatService {
    private logger = new Logger(CombatService.name);
    private readonly victoriesToWin = 3;

    constructor(private startingPointService: StartingPointService) {}

    canFight(attacker: Character, defender: Character): boolean {
        const distance = Math.abs(attacker.position.x - defender.position.x) +
            Math.abs(attacker.position.y - defender.position.y);
        const hasActions = attacker.remainingActions !== undefined && attacker.remainingActions > 0;
        return distance === 1 && hasActions;
    }

    executeCombat(
        gameSession: GameSession,
        attacker: Character,
        defender: Character,
        mapConfig: GameMap,
    ): CombatResult {
        // Decrement attacker's remaining actions
        if (attacker.remainingActions !== undefined && attacker.remainingActions > 0) {
            attacker.remainingActions -= 1;
        }

        attacker.victories++;

        const isGameWon = attacker.victories >= this.victoriesToWin;

        const newPosition = this.getDefenderRespawnPosition(
            gameSession,
            defender,
            mapConfig,
        );

        defender.position = newPosition;

        return {
            winner: attacker.id,
            loser: defender.id,
            attackerVictories: attacker.victories,
            defenderKnockedDown: true,
            gameWon: isGameWon,
        };
    }

    private getDefenderRespawnPosition(
        gameSession: GameSession,
        defender: Character,
        mapConfig: GameMap,
    ): Position {
        const defenderStartingPoint = gameSession.getStartingPoint(defender.id);

        if (!defenderStartingPoint) {
            throw new Error(`No starting point found for player ${defender.id}`);
        }

        const occupiedPositions: Position[] = gameSession.players
            .filter(p => p.character.id !== defender.id)
            .map(p => p.character.position);

        const isStartingPointOccupied = occupiedPositions.some(
            p => p.x === defenderStartingPoint.x && p.y === defenderStartingPoint.y,
        );

        if (!isStartingPointOccupied) {
            return defenderStartingPoint;
        }

        return this.startingPointService.getClosestAvailableStartingPoint(
            defenderStartingPoint,
            mapConfig,
            occupiedPositions,
        );
    }

    checkGameWinCondition(players: Character[]): Character | null {
        for (const player of players) {
            if (player.victories >= this.victoriesToWin) {
                return player;
            }
        }
        return null;
    }

    getCombatInfo(attacker: Character, defender: Character): CombatInfo {
        return {
            attacker: {
                id: attacker.id,
                name: attacker.name,
                avatarId: attacker.avatarId,
                victories: attacker.victories,
            },
            defender: {
                id: defender.id,
                name: defender.name,
                avatarId: defender.avatarId,
                victories: defender.victories,
            },
        };
    }
}

export interface CombatResult {
    winner: string;
    loser: string;
    attackerVictories: number;
    defenderKnockedDown: boolean;
    gameWon: boolean;
}

export interface CombatInfo {
    attacker: {
        id: string;
        name: string;
        avatarId: number;
        victories: number;
    };
    defender: {
        id: string;
        name: string;
        avatarId: number;
        victories: number;
    };
}

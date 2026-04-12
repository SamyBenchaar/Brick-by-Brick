import { GameSession, Position } from '@app/domain/game-session';
import { CombatInfo, CombatResult, GameMap } from '@app/interfaces/game-map-interfaces';
import { Character } from '@common/character';
import { VICTORIES_TO_WIN } from '@common/constants/game-config-constants';
import { Injectable } from '@nestjs/common';
import { StartingPointService } from './starting-point.service';


@Injectable()
export class CombatService {
    private readonly victoriesToWin = VICTORIES_TO_WIN;

    constructor(private startingPointService: StartingPointService) {}

    canFight(attacker: Character, defender: Character, gameSession?: GameSession): boolean {
        const distance = Math.abs(attacker.position.x - defender.position.x) +
            Math.abs(attacker.position.y - defender.position.y);
        const hasActions = attacker.remainingActions !== undefined && attacker.remainingActions > 0;

        if (gameSession?.gameMode === 'ctf' && gameSession.playerTeams) {
            const attackerTeam = gameSession.playerTeams.get(attacker.id);
            const defenderTeam = gameSession.playerTeams.get(defender.id);
            if (attackerTeam && defenderTeam && attackerTeam === defenderTeam) {
                return false;
            }
        }

        return distance === 1 && hasActions;
    }

    executeCombat(
        gameSession: GameSession,
        attacker: Character,
        defender: Character,
        mapConfig: GameMap,
    ): CombatResult {
        if (attacker.remainingActions !== undefined && attacker.remainingActions > 0) {
            attacker.remainingActions -= 1;
        }

        attacker.victories++;

        const isGameWon = attacker.victories >= this.victoriesToWin;

        if (defender.hasFlag && gameSession.gameMode === 'ctf') {
            gameSession.dropFlag(defender.position);
        }

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

        return this.startingPointService.getAfterCombatPosition(
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

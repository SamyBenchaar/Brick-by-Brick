import { GameSession, Position } from '@app/domain/game-session';
import { CombatInfo, CombatResult, GameMap } from '@app/interfaces/game-map-interfaces';
import { Character } from '@common/character';
import { VICTORIES_TO_WIN } from '@common/constants/game-config-constants';
import { Injectable, Logger } from '@nestjs/common';
import { StartingPointService } from './starting-point.service';


@Injectable()
export class CombatService {
    private logger = new Logger(CombatService.name);
    private readonly victoriesToWin = VICTORIES_TO_WIN;

    checkGameWinCondition(players: Character[]): Character | null {
        for (const player of players) {
            if (player.victories >= this.victoriesToWin) {
                return player;
            }
        }
        return null;
    }

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

}

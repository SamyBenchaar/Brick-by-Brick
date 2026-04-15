import { GameSession } from '@app/domain/game-session';
import { Character } from '@common/character';
import { VICTORIES_TO_WIN,GameModeValue } from '@common/constants/game-config-constants';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CombatService {
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
        const hasActions = (attacker.remainingActions ?? 0) > 0;

        if (gameSession?.gameMode === GameModeValue.Ctf && gameSession.playerTeams) {
            const attackerTeam = gameSession.playerTeams.get(attacker.id);
            const defenderTeam = gameSession.playerTeams.get(defender.id);
            if (attackerTeam && defenderTeam && attackerTeam === defenderTeam) {
                return false;
            }
        }

        return distance === 1 && hasActions;
    }

}

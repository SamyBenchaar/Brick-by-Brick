import { GameSession } from '@app/domain/game-session';
import { CombatParticipants } from '@app/services/game-session/combat/combat-types';
import { Character } from '@common/character';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CombatRequestValidatorService {
    isCombatUnavailable(gameSession: GameSession): boolean {
        return gameSession.isTurnStarting || gameSession.getActiveCombat() !== null;
    }

    getCombatParticipantsFromRequest(
        gameSession: GameSession,
        socketId: string,
        defenderId: string,
    ): CombatParticipants | null {
        const attacker = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find((player) => player.socketId === socketId);
        const defender = gameSession.players.find((player) => player.character.id === defenderId)?.character;

        if (!attacker || !requestingPlayer || !defender) {
            return null;
        }

        return { attacker, defender, requestingPlayer };
    }

    canStartCombat(gameSession: GameSession, participants: CombatParticipants): boolean {
        return this.isRequesterCurrentPlayer(participants) &&
            this.hasRemainingCombatAction(participants.attacker) &&
            this.areCombatantsAdjacent(participants.attacker, participants.defender) &&
            !this.areAlliesInCtf(gameSession, participants.attacker, participants.defender);
    }

    private isRequesterCurrentPlayer(participants: CombatParticipants): boolean {
        return participants.attacker.id === participants.requestingPlayer.character.id;
    }

    private hasRemainingCombatAction(attacker: Character): boolean {
        return (attacker.remainingActions ?? 0) > 0;
    }

    private areCombatantsAdjacent(attacker: Character, defender: Character): boolean {
        const horizontalDistance = Math.abs(attacker.position.x - defender.position.x);
        const verticalDistance = Math.abs(attacker.position.y - defender.position.y);

        return horizontalDistance + verticalDistance === 1;
    }

    private areAlliesInCtf(gameSession: GameSession, attacker: Character, defender: Character): boolean {
        const isCtfMode = gameSession.gameMode === 'ctf';
        const bothTeamsKnown = !!attacker.team && !!defender.team;

        return isCtfMode && bothTeamsKnown && attacker.team === defender.team;
    }
}

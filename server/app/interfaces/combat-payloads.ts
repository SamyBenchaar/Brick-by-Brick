import { CombatRoundDetails } from '@app/constants/combat-types';
import { GameSession } from '@app/domain/game-session';
import { Character } from '@common/character';
import { ActiveCombat, CombatOutcome } from '@common/combat';

export interface BuildCombatEndStatePayload {
    gameSession: GameSession;
    attacker: Character;
    defender: Character;
    combat: ActiveCombat;
    outcome: CombatOutcome;
}

export interface LoserResolutionPayload {
    attacker: Character;
    defender: Character;
    attackerDefeated: boolean;
    defenderDefeated: boolean;
}

export interface BuildRoundDetailsPayload {
    gameSession: GameSession;
    combat: ActiveCombat;
    attacker: Character;
    defender: Character;
}

export interface ApplyRoundDamagePayload {
    combat: ActiveCombat;
    roundDetails: CombatRoundDetails;
    attacker: Character;
    defender: Character;
}

export interface CombatScorePayload {
    gameSession: GameSession;
    character: Character;
    combat: ActiveCombat;
    isAttackMode: boolean;
    isAttacker: boolean;
}
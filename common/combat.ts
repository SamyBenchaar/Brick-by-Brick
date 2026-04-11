import { Position } from './position';

export const COMBAT_POSTURE = {
  NONE: 'none',
  OFFENSIVE: 'offensive',
  DEFENSIVE: 'defensive',
}

export type CombatOutcome = 'attacker' | 'defender' | 'draw';

export interface ActiveCombat {
    attackerId: string;
    defenderId: string;
    initiatorId: string;

    roundNumber: number;

    attackerPosture?: string;
    defenderPosture?: string;

    attackerHp: number;
    defenderHp: number;
}

export interface CombatValueDetail {
    base: number;
    postureBonus: number;
    dice: number;
    tilePenalty: number;
    total: number;
}

export interface CombatStrikeDetail {
    attack: CombatValueDetail;
    defense: CombatValueDetail;
    damage: number;
}

export interface CombatStartedPayload {
    attackerId: string;
    defenderId: string;
    roundNumber: number;
    remainingTurnTime: number;
}

export interface CombatRoundResolvedPayload {
    roundNumber: number;
    attackerId: string;
    defenderId: string;
    attackerChoice: string;
    defenderChoice: string;
    attackerStrike: CombatStrikeDetail;
    defenderStrike: CombatStrikeDetail;
    attackerLife: number;
    defenderLife: number;
}

export interface CombatEndedPayload {
    winnerId: string | null;
    loserIds: string[];
    outcome: CombatOutcome;
    attackerPosition: Position | null;
    defenderPosition: Position | null;
    attackerLife: number;
    defenderLife: number;
    attackerVictories: number;
    defenderVictories: number;
    flagPosition: Position | null;
    remainingActions: number;
    turnShouldContinue: boolean;
    remainingTurnTime: number;
}

export interface SubmitCombatChoicePayload {
    roomId: string;
    posture: string;
}

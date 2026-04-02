import { Dice } from './dice';
import { Position } from './position';

export enum CombatPosture {
    None = 'none',
    Offensive = 'offensive',
    Defensive = 'defensive',
}

export interface CombatScoreDetail {
    base: number;
    postureBonus: number;
    dice: number;
    penalty: number;
    total: number;
}

export interface CombatPlayerState {
    id: string;
    name: string;
    avatarId: number;
    life: number;
    maxLife: number;
    attack: number;
    defense: number;
    attackDice: Dice;
    defenseDice: Dice;
    victories: number;
    position?: Position;
    posture: CombatPosture;
    hasChosen: boolean;
}

export interface CombatRoundDetail {
    attackerAttack: CombatScoreDetail;
    attackerDefense: CombatScoreDetail;
    defenderAttack: CombatScoreDetail;
    defenderDefense: CombatScoreDetail;
    damageToAttacker: number;
    damageToDefender: number;
}

export interface CombatState {
    attacker: CombatPlayerState;
    defender: CombatPlayerState;
    instigatorId: string;
    activePlayerId: string;
    round: number;
    timeRemaining: number;
    lastRound: CombatRoundDetail | null;
}

export interface CombatResultPayload {
    attackerId: string;
    defenderId: string;
    winnerId: string | null;
    loserIds: string[];
    attackerVictories: number;
    defenderVictories: number;
    attackerLife: number;
    defenderLife: number;
    attackerPosition?: Position;
    defenderPosition?: Position;
    activePlayerWon: boolean;
    remainingActions: number;
}

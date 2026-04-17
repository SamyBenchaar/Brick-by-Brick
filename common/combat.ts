import { Position } from './position';

export enum CombatPosture {
    NONE = 'none',
    OFFENSIVE = 'offensive',
    DEFENSIVE = 'defensive',
}

export enum CombatOutcome {
    ATTACKER = 'attacker',
    DEFENDER = 'defender',
    DRAW = 'draw',
}

export interface ActiveCombat {
    attackerId: string;
    defenderId: string;
    initiatorId: string;

    roundNumber: number;

    attackerPosture?: CombatPosture;
    defenderPosture?: CombatPosture;

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
    attackerChoice: CombatPosture;
    defenderChoice: CombatPosture;
    attackerStrike: CombatStrikeDetail;
    defenderStrike: CombatStrikeDetail;
    attackerLife: number;
    defenderLife: number;
}

export interface CombatResultPayload {
    attackerId: string;
    defenderId: string;
    winnerId: string | null;
    loserIds: string[];
    outcome: CombatOutcome;
    attackerPosition: Position;
    defenderPosition: Position;
    attackerLife: number;
    defenderLife: number;
    attackerVictories: number;
    defenderVictories: number;
    remainingActions: number;
    remainingTurnTime: number;
    turnShouldContinue: boolean;
    flagPosition: Position | null;
    flagHolderId: string | null;
};

export interface SubmitCombatChoicePayload {
    roomId: string;
    posture: CombatPosture;
}

export interface CombatEndedPayload {
    reason: string;
    abandonedPlayerId?: string;
    survivorId?: string;
    survivorVictories?: number;
    survivorLife?: number;
}

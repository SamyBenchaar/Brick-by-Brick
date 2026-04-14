import { Character } from '@common/character';
import { ActiveCombat, CombatValueDetail } from '@common/combat';
import { Player } from '@common/player';
import { Position } from '@common/position';

export type CombatParticipants = {
    attacker: Character;
    defender: Character;
    requestingPlayer: Player;
};

export type CombatRoundDetails = {
    attackerAttackDetail: CombatValueDetail;
    attackerDefenseDetail: CombatValueDetail;
    defenderAttackDetail: CombatValueDetail;
    defenderDefenseDetail: CombatValueDetail;
    damageToDefender: number;
    damageToAttacker: number;
};

export type CombatRoundOutcome = 'attacker' | 'defender' | 'draw';

export type CombatEndState = {
    attacker: Character;
    defender: Character;
    winner: Character | null;
    loserIds: string[];
    outcome: CombatRoundOutcome;
    attackerPosition: Position;
    defenderPosition: Position;
    turnShouldContinue: boolean;
};

export type CombatTurnActors = {
    combat: ActiveCombat;
    attacker: Character;
    defender: Character;
};

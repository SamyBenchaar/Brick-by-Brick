import { Character } from '@common/character';
import { ActiveCombat, CombatValueDetail } from '@common/combat';

export function formatCombatLog(
    detail: CombatValueDetail,
    type: 'attack' | 'defense'
): string {
    return `${type === 'attack' ? '⚔️' : '🛡️'} `
        + `${detail.base}`
        + `${detail.postureBonus ? ` +${detail.postureBonus}` : ''}`
        + `${detail.dice ? ` +🎲${detail.dice}` : ''}`
        + `${detail.tilePenalty ? ` ${detail.tilePenalty}` : ''}`
        + ` = ${detail.total}`;
}

export function formatCombatRoundLog(
    combat: ActiveCombat,
    attacker: Character,
    defender: Character,
    attackerAttackDetail: CombatValueDetail,
    attackerDefenseDetail: CombatValueDetail,
    defenderAttackDetail: CombatValueDetail,
    defenderDefenseDetail: CombatValueDetail,
    damageToDefender: number,
    damageToAttacker: number,
    result: 'attacker' | 'defender' | 'tie',
): string {
    const roundNumber = `Manche ${combat.roundNumber}`;
    const roundOutcome = result === 'tie'
        ? `Égalité entre ${attacker.name} et ${defender.name}`
        : result === 'attacker'
            ? `${attacker.name} remporte la manche contre ${defender.name}`
            : `${defender.name} remporte la manche contre ${attacker.name}`;

    const attackerAttackLine = `Attaque ${attacker.name} : ${formatCombatLog(attackerAttackDetail, 'attack')}\n`;
    const attackerDefenseLine = `Défense ${attacker.name} : ${formatCombatLog(attackerDefenseDetail, 'defense')}\n`;
    const defenderAttackLine = `Attaque ${defender.name} : ${formatCombatLog(defenderAttackDetail, 'attack')}\n`;
    const defenderDefenseLine = `Défense ${defender.name} : ${formatCombatLog(defenderDefenseDetail, 'defense')}\n`;

    const diffAttackVsDefenseTotal = attackerAttackDetail.total - defenderDefenseDetail.total;
    const diffDefenseVsAttackTotal = defenderAttackDetail.total - attackerDefenseDetail.total;

    const diffAttackVsDefense = `Différence attaque ${attacker.name} vs défense ${defender.name}: ${attackerAttackDetail.total} - ${defenderDefenseDetail.total} = ${diffAttackVsDefenseTotal}\n`;
    const diffDefenseVsAttack = `Différence attaque ${defender.name} vs défense  ${attacker.name} : ${defenderAttackDetail.total} - ${attackerDefenseDetail.total} = ${diffDefenseVsAttackTotal}\n`;

    const attackerResult = damageToDefender > 0
        ? `${attacker.name} inflige ${damageToDefender} dégâts à ${defender.name}`
        : `${attacker.name} n'inflige aucun dégât à ${defender.name}`;
    const defenderResult = damageToAttacker > 0
        ? `${defender.name} inflige ${damageToAttacker} dégâts à ${attacker.name}`
        : `${defender.name} n'inflige aucun dégât à ${attacker.name}`;

    return [
        roundNumber,
        attackerAttackLine,
        attackerDefenseLine,
        defenderAttackLine,
        defenderDefenseLine,
        diffAttackVsDefense,
        diffDefenseVsAttack,
        `Résultat : ${attackerResult}; ${defenderResult}`,
        roundOutcome,
    ].join('\n');
}
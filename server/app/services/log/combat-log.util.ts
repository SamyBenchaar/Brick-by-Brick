import { Character } from '@common/character';
import { CombatOutcome, CombatRoundResolvedPayload, CombatValueDetail } from '@common/combat';

function formatCombatLog(
    detail: CombatValueDetail,
    type: 'attack' | 'defense',
): string {
    return `${type === 'attack' ? '⚔️' : '🛡️'} `
        + `${detail.base}`
        + `${detail.postureBonus ? ` +${detail.postureBonus}` : ''}`
        + `${detail.dice ? ` +🎲${detail.dice}` : ''}`
        + `${detail.tilePenalty ? ` ${detail.tilePenalty}` : ''}`
        + ` = ${detail.total}`;
}

export function formatCombatRoundLog(payload: CombatRoundResolvedPayload, attacker: Character,
    defender: Character, result: CombatOutcome): string {

    const roundNumber = `Manche: ${payload.roundNumber}`;
    const roundOutcome = result === CombatOutcome.DRAW
        ? `Égalité entre ${attacker.name} et ${defender.name}`
        : result === CombatOutcome.ATTACKER
            ? `${attacker.name} remporte la manche contre ${defender.name}`
            : `${defender.name} remporte la manche contre ${attacker.name}`;

    const attackerAttackLine = `Attaque ${attacker.name}: ${formatCombatLog(payload.attackerStrike.attack, 'attack')}`;
    const attackerDefenseLine = `Défense ${attacker.name}: ${formatCombatLog(payload.attackerStrike.defense, 'defense')}`;
    const defenderAttackLine = `Attaque ${defender.name}: ${formatCombatLog(payload.defenderStrike.attack, 'attack')}`;
    const defenderDefenseLine = `Défense ${defender.name}: ${formatCombatLog(payload.defenderStrike.defense, 'defense')}`;

    const diffAttackVsDefenseTotal =
        payload.attackerStrike.attack.total - payload.defenderStrike.defense.total;
    const diffDefenseVsAttackTotal =
        payload.defenderStrike.attack.total - payload.attackerStrike.defense.total;
    const diffAttackVsDefense = `Différence attaque ${attacker.name} vs défense ${defender.name}: `
        + `${payload.attackerStrike.attack.total} - ${payload.defenderStrike.defense.total} = ${diffAttackVsDefenseTotal}`;
    const diffDefenseVsAttack = `Différence attaque ${defender.name} vs défense ${attacker.name}: `
        + `${payload.defenderStrike.attack.total} - ${payload.attackerStrike.defense.total} = ${diffDefenseVsAttackTotal}\n`;

    const attackerResult = payload.attackerStrike.damage > 0
        ? `${attacker.name} inflige ${payload.attackerStrike.damage} dégâts à ${defender.name}`
        : `${attacker.name} n'inflige aucun dégât à ${defender.name}`;
    const defenderResult = payload.defenderStrike.damage > 0
        ? `${defender.name} inflige ${payload.defenderStrike.damage} dégâts à ${attacker.name}`
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
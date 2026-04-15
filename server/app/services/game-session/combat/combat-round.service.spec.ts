import { GameSession } from '@app/domain/game-session';
import { CombatRoundDetails } from '@app/services/game-session/combat/combat-types';
import { CombatRoundService } from './combat-round.service';
import { Character } from '@common/character';
import { ActiveCombat, COMBAT_POSTURE } from '@common/combat';
import { Dice } from '@common/dice';
import { TileType } from '@common/map';

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;
const ICE_PENALTY = -2;

function createCharacter(overrides: Partial<Character> = {}): Character {
    return {
        id: 'player',
        isActif: false,
        battlesWon: 0,
        name: 'Player',
        avatarId: 1,
        maxLife: DEFAULT_LIFE,
        life: DEFAULT_LIFE,
        speed: DEFAULT_SPEED,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
        movements: DEFAULT_MOVEMENTS,
        actions: DEFAULT_ACTIONS,
        attackDice: Dice.D4,
        defenseDice: Dice.D6,
        position: { x: 0, y: 0 },
        remainingMovement: DEFAULT_MOVEMENTS,
        remainingActions: DEFAULT_ACTIONS,
        victories: 0,
        defeats: 0,
        totalDamageDealt: 0,
        totalDamageReceived: 0,
        tilesVisited: 0,
        hasFlag: false,
        ...overrides,
    };
}

function createCombat(overrides: Partial<ActiveCombat> = {}): ActiveCombat {
    return {
        attackerId: 'attacker',
        defenderId: 'defender',
        initiatorId: 'attacker',
        roundNumber: 1,
        attackerHp: DEFAULT_LIFE,
        defenderHp: DEFAULT_LIFE,
        ...overrides,
    };
}

describe('CombatRoundService', () => {
    let service: CombatRoundService;
    let attacker: Character;
    let defender: Character;

    beforeEach(() => {
        service = new CombatRoundService();
        attacker = createCharacter({
            id: 'attacker',
            attack: DEFAULT_ATTACK,
            defense: DEFAULT_DEFENSE,
            attackDice: Dice.D4,
            defenseDice: Dice.D6,
            position: { x: 0, y: 0 },
        });
        defender = createCharacter({
            id: 'defender',
            attack: DEFAULT_ATTACK,
            defense: DEFAULT_DEFENSE,
            attackDice: Dice.D4,
            defenseDice: Dice.D6,
            position: { x: 1, y: 0 },
        });
    });

    it('devrait appliquer les bonus de posture, la pénalité de glace et le mode debug max/min', () => {
        const gameSession = {
            isDebugModeActivated: true,
            getMapCopy: jest.fn(() => ({
                tiles: [
                    [{ type: TileType.Base }, { type: TileType.Ice }],
                ],
            })),
        } as unknown as GameSession;

        const combat = createCombat({
            attackerPosture: COMBAT_POSTURE.OFFENSIVE,
            defenderPosture: COMBAT_POSTURE.DEFENSIVE,
        });

        const details = service.buildRoundDetails(gameSession, combat, attacker, defender);

        expect(details.attackerAttackDetail).toEqual({
            base: DEFAULT_ATTACK,
            postureBonus: 2,
            dice: 4,
            tilePenalty: 0,
            total: 10,
        });
        expect(details.defenderDefenseDetail).toEqual({
            base: DEFAULT_DEFENSE,
            postureBonus: 2,
            dice: 1,
            tilePenalty: ICE_PENALTY,
            total: 5,
        });
        expect(details.damageToDefender).toBe(5);
        expect(details.damageToAttacker).toBe(0);
    });

    it('devrait appliquer les dégâts sans dépasser les hp restants et mettre à jour les statistiques', () => {
        const combat = createCombat({
            attackerHp: 2,
            defenderHp: 3,
        });

        const roundDetails: CombatRoundDetails = {
            attackerAttackDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            attackerDefenseDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            defenderAttackDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            defenderDefenseDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            damageToAttacker: 5,
            damageToDefender: DEFAULT_ATTACK,
        };

        service.applyRoundDamage(combat, roundDetails, attacker, defender);

        expect(combat.attackerHp).toBe(0);
        expect(combat.defenderHp).toBe(0);
        expect(attacker.totalDamageDealt).toBe(3);
        expect(attacker.totalDamageReceived).toBe(2);
        expect(defender.totalDamageDealt).toBe(2);
        expect(defender.totalDamageReceived).toBe(3);
    });

    it('devrait construire le payload résolu avec none si aucune posture n’a été choisie', () => {
        const payload = service.buildRoundResolvedPayload(
            createCombat({
                roundNumber: 3,
                attackerHp: 5,
                defenderHp: 2,
            }),
            {
                attackerAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 2, tilePenalty: 0, total: DEFAULT_LIFE },
                attackerDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: 3, tilePenalty: 0, total: 7 },
                defenderAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                defenderDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: DEFAULT_ATTACK, tilePenalty: 0, total: 8 },
                damageToAttacker: 0,
                damageToDefender: 1,
            },
        );

        expect(payload.attackerChoice).toBe(COMBAT_POSTURE.NONE);
        expect(payload.defenderChoice).toBe(COMBAT_POSTURE.NONE);
        expect(payload.attackerStrike.damage).toBe(1);
        expect(payload.defenderStrike.damage).toBe(0);
    });

    it('devrait retourner draw si les deux combattants tombent à 0', () => {
        expect(service.getCombatOutcome(createCombat({ attackerHp: 0, defenderHp: 0 }))).toBe('draw');
    });

    it('devrait retourner attacker si seul le défenseur tombe à 0', () => {
        expect(service.getCombatOutcome(createCombat({ attackerHp: 2, defenderHp: 0 }))).toBe('attacker');
    });

    it('devrait préparer le prochain round en incrémentant le numéro et en vidant les postures', () => {
        const combat = createCombat({
            attackerPosture: COMBAT_POSTURE.OFFENSIVE,
            defenderPosture: COMBAT_POSTURE.DEFENSIVE,
        });

        service.prepareNextRound(combat);

        expect(combat.roundNumber).toBe(2);
        expect(combat.attackerPosture).toBeUndefined();
        expect(combat.defenderPosture).toBeUndefined();
    });
});
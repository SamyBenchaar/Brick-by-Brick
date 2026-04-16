import { GameSession } from '@app/domain/game-session';
import { CombatRoundDetails } from '@app/services/game-session/combat/combat-types';
import { Character } from '@common/character';
import { ActiveCombat, CombatPosture } from '@common/combat';
import { Dice } from '@common/dice';
import { TileType } from '@common/map';
import { CombatRoundService } from './combat-round.service';

const DEFAULT_LIFE = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const DEFAULT_SPEED = 4;
const DEFAULT_MOVEMENTS = 3;
const DEFAULT_ACTIONS = 1;
const ICE_PENALTY = -2;
const HIGH_DAMAGE_VALUE = 5;
const THREE_POINTS = 3;

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

/**
 * Strategie de test (Service de logique serveur):
 * Use cases vises:
 * - Calcul d'un round complet: posture, des, penalites de terrain, degats infliges.
 * - Comportement du mode debug (max/min) et retour au comportement normal entre deux rounds.
 * - Transition d'etat du combat: mise a jour HP, determination outcome, preparation du round suivant.
 * - Validation du payload technique envoye au gateway/client apres resolution de round.
 *
 * Mocks / Stubs / Spies:
 * - Stubs de GameSession pour controler map/debug mode sans dependre d une session reelle.
 * - Spy sur Math.random pour rendre le tirage deterministe en mode non-debug.
 * - Assertions sur structures detaillees (round details/payload) pour verifier les contrats de sortie.
 *
 * Cas limites couverts et raison:
 * - Aucun tile trouve sous le joueur: confirme qu'aucune penalite fantome n'est appliquee.
 * - Egalite de degats: valide la branche draw du vainqueur de round.
 * - Outcome null quand personne n'est KO: garantit que le combat continue tant que les conditions de fin ne sont pas atteintes.
 */
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
            attackerPosture: CombatPosture.OFFENSIVE,
            defenderPosture: CombatPosture.DEFENSIVE,
        });

        const details = service.buildRoundDetails({ gameSession, combat, attacker, defender });

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
            total: HIGH_DAMAGE_VALUE,
        });
        expect(details.damageToDefender).toBe(HIGH_DAMAGE_VALUE);
        expect(details.damageToAttacker).toBe(0);
    });

    it('devrait appliquer puis retirer les des forces quand le debug est active puis desactive entre deux rounds', () => {
        const gameSession = {
            isDebugModeActivated: true,
            getMapCopy: jest.fn(() => ({
                tiles: [
                    [{ type: TileType.Base }, { type: TileType.Base }],
                ],
            })),
        } as unknown as GameSession;

        const combat = createCombat({
            attackerPosture: CombatPosture.NONE,
            defenderPosture: CombatPosture.NONE,
        });

        const debugRound = service.buildRoundDetails({ gameSession, combat, attacker, defender });
        expect(debugRound.attackerAttackDetail.dice).toBe(DEFAULT_ATTACK);
        expect(debugRound.defenderAttackDetail.dice).toBe(1);
        expect(debugRound.attackerDefenseDetail.dice).toBe(DEFAULT_LIFE);
        expect(debugRound.defenderDefenseDetail.dice).toBe(1);

        gameSession.isDebugModeActivated = false;
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

        const normalRound = service.buildRoundDetails({ gameSession, combat, attacker, defender });

        expect(normalRound.attackerAttackDetail.dice).toBe(1);
        expect(normalRound.defenderAttackDetail.dice).toBe(1);
        expect(normalRound.attackerDefenseDetail.dice).toBe(1);
        expect(normalRound.defenderDefenseDetail.dice).toBe(1);

        randomSpy.mockRestore();
    });

    it('devrait calculer sans penalite de tuile quand la case est absente', () => {
        const gameSession = {
            isDebugModeActivated: true,
            getMapCopy: jest.fn(() => ({
                tiles: [[{ type: TileType.Base }]],
            })),
        } as unknown as GameSession;

        const offMapDefender = createCharacter({
            id: 'defender',
            position: { x: 99, y: 99 },
            attackDice: Dice.D4,
            defenseDice: Dice.D6,
        });

        const details = service.buildRoundDetails({
            gameSession,
            combat: createCombat({
                attackerPosture: CombatPosture.NONE,
                defenderPosture: CombatPosture.NONE,
            }),
            attacker,
            defender: offMapDefender,
        });

        expect(details.attackerAttackDetail.tilePenalty).toBe(0);
        expect(details.defenderAttackDetail.tilePenalty).toBe(0);
        expect(details.defenderDefenseDetail.tilePenalty).toBe(0);
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

        service.applyRoundDamage({ combat, roundDetails, attacker, defender });

        expect(combat.attackerHp).toBe(0);
        expect(combat.defenderHp).toBe(0);
        expect(attacker.totalDamageDealt).toBe(THREE_POINTS);
        expect(attacker.totalDamageReceived).toBe(2);
        expect(defender.totalDamageDealt).toBe(2);
        expect(defender.totalDamageReceived).toBe(THREE_POINTS);
    });

    it('devrait mettre les hp a zero quand les degats sont exactement egaux aux hp restants', () => {
        const combat = createCombat({
            attackerHp: 2,
            defenderHp: 3,
        });

        const roundDetails: CombatRoundDetails = {
            attackerAttackDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            attackerDefenseDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            defenderAttackDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            defenderDefenseDetail: { base: 0, postureBonus: 0, dice: 0, tilePenalty: 0, total: 0 },
            damageToAttacker: 2,
            damageToDefender: 3,
        };

        service.applyRoundDamage({ combat, roundDetails, attacker, defender });

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
                roundNumber: THREE_POINTS,
                attackerHp: 5,
                defenderHp: 2,
            }),
            {
                attackerAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 2, tilePenalty: 0, total: DEFAULT_LIFE },
                attackerDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: THREE_POINTS, tilePenalty: 0, total: 7 },
                defenderAttackDetail: { base: DEFAULT_ATTACK, postureBonus: 0, dice: 1, tilePenalty: 0, total: 5 },
                defenderDefenseDetail: { base: DEFAULT_DEFENSE, postureBonus: 0, dice: DEFAULT_ATTACK, tilePenalty: 0, total: 8 },
                damageToAttacker: 0,
                damageToDefender: 1,
            },
        );

        expect(payload.attackerChoice).toBe(CombatPosture.NONE);
        expect(payload.defenderChoice).toBe(CombatPosture.NONE);
        expect(payload.attackerStrike.damage).toBe(1);
        expect(payload.defenderStrike.damage).toBe(0);
    });

    it('devrait retourner draw si les deux combattants tombent à 0', () => {
        expect(service.getCombatOutcome(createCombat({ attackerHp: 0, defenderHp: 0 }))).toBe('draw');
    });

    it('devrait retourner attacker si seul le défenseur tombe à 0', () => {
        expect(service.getCombatOutcome(createCombat({ attackerHp: 2, defenderHp: 0 }))).toBe('attacker');
    });

    it('devrait retourner defender si seul l attaquant tombe a 0', () => {
        expect(service.getCombatOutcome(createCombat({ attackerHp: 0, defenderHp: 2 }))).toBe('defender');
    });

    it('devrait retourner null si les deux combattants sont encore vivants', () => {
        expect(service.getCombatOutcome(createCombat({ attackerHp: 2, defenderHp: 2 }))).toBeNull();
    });

    it('devrait determiner attacker comme vainqueur de round si le defenseur prend plus de degats', () => {
        expect(service.determineRoundWinner(1, THREE_POINTS)).toBe('attacker');
    });

    it('devrait determiner defender comme vainqueur de round si l attaquant prend plus de degats', () => {
        expect(service.determineRoundWinner(DEFAULT_ATTACK, 1)).toBe('defender');
    });

    it('devrait determiner draw en cas d egalite de degats', () => {
        expect(service.determineRoundWinner(2, 2)).toBe('draw');
    });

    it('devrait préparer le prochain round en incrémentant le numéro et en vidant les postures', () => {
        const combat = createCombat({
            attackerPosture: CombatPosture.OFFENSIVE,
            defenderPosture: CombatPosture.DEFENSIVE,
        });

        service.prepareNextRound(combat);

        expect(combat.roundNumber).toBe(2);
        expect(combat.attackerPosture).toBeUndefined();
        expect(combat.defenderPosture).toBeUndefined();
    });
});
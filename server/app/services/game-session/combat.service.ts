import { GameSession, Position } from '@app/domain/game-session';
import { CombatInfo, CombatResult, GameMap } from '@app/interfaces/game-map-interfaces';
import { Character } from '@common/character';
import {
    CombatPlayerState,
    CombatPosture,
    CombatResultPayload,
    CombatRoundDetail,
    CombatScoreDetail,
    CombatState,
} from '@common/combat';
import { VICTORIES_TO_WIN } from '@common/constants/game-config-constants';
import { Dice } from '@common/dice';
import { TileType } from '@common/map';
import { Injectable } from '@nestjs/common';
import { StartingPointService } from './starting-point.service';

@Injectable()
export class CombatService {
    private static readonly d4Max = 4;
    private static readonly d6Max = 6;
    private readonly victoriesToWin = VICTORIES_TO_WIN;
    private readonly combatTurnDuration = 10;
    private readonly postureBonus = 2;
    private readonly icePenalty = -2;

    constructor(private startingPointService: StartingPointService) {}

    canFight(attacker: Character, defender: Character, gameSession?: GameSession): boolean {
        const distance = Math.abs(attacker.position.x - defender.position.x) +
            Math.abs(attacker.position.y - defender.position.y);
        const hasActions = attacker.remainingActions !== undefined && attacker.remainingActions > 0;

        if (gameSession?.gameMode === 'ctf' && gameSession.playerTeams) {
            const attackerTeam = gameSession.playerTeams.get(attacker.id);
            const defenderTeam = gameSession.playerTeams.get(defender.id);
            if (attackerTeam && defenderTeam && attackerTeam === defenderTeam) {
                return false;
            }
        }

        return distance === 1 && hasActions;
    }

    startCombat(gameSession: GameSession, attacker: Character, defender: Character): CombatState {
        attacker.remainingActions = Math.max(0, (attacker.remainingActions ?? 0) - 1);
        return {
            attacker: this.toCombatPlayer(attacker),
            defender: this.toCombatPlayer(defender),
            instigatorId: attacker.id,
            activePlayerId: attacker.id,
            round: 1,
            timeRemaining: this.combatTurnDuration,
            lastRound: null,
        };
    }

    submitChoice(combat: CombatState, playerId: string, posture: CombatPosture): void {
        const player = this.getCombatPlayer(combat, playerId);
        if (!player || player.hasChosen) return;
        player.posture = posture;
        player.hasChosen = true;
    }

    bothPlayersReady(combat: CombatState): boolean {
        return combat.attacker.hasChosen && combat.defender.hasChosen;
    }

    tickCombat(combat: CombatState): number {
        combat.timeRemaining = Math.max(0, combat.timeRemaining - 1);
        return combat.timeRemaining;
    }

    resolveRound(gameSession: GameSession, combat: CombatState, isDebugModeActivated: boolean): 
    { combat: CombatState; result?: CombatResultPayload } {
        const attacker = this.findCharacter(gameSession, combat.attacker.id);
        const defender = this.findCharacter(gameSession, combat.defender.id);
        if (!attacker || !defender) throw new Error('Combat participants not found');

        const lastRound = this.buildRoundDetail(gameSession, combat, attacker, defender, isDebugModeActivated);
        attacker.life = Math.max(0, attacker.life - lastRound.damageToAttacker);
        defender.life = Math.max(0, defender.life - lastRound.damageToDefender);
        combat.attacker.life = attacker.life;
        combat.defender.life = defender.life;
        combat.lastRound = lastRound;

        const attackerDown = attacker.life <= 0;
        const defenderDown = defender.life <= 0;

        if (!attackerDown && !defenderDown) {
            combat.round += 1;
            combat.timeRemaining = this.combatTurnDuration;
            combat.attacker.hasChosen = false;
            combat.defender.hasChosen = false;
            combat.attacker.posture = CombatPosture.None;
            combat.defender.posture = CombatPosture.None;
            return { combat };
        }

        let winnerId: string | null = null;
        const loserIds: string[] = [];

        if (attackerDown && defenderDown) {
            loserIds.push(attacker.id, defender.id);
            this.resetAfterLoss(gameSession, attacker);
            this.resetAfterLoss(gameSession, defender);
        } else if (defenderDown) {
            winnerId = attacker.id;
            loserIds.push(defender.id);
            attacker.victories = (attacker.victories ?? 0) + 1;
            this.resetAfterLoss(gameSession, defender);
        } else {
            winnerId = defender.id;
            loserIds.push(attacker.id);
            defender.victories = (defender.victories ?? 0) + 1;
            this.resetAfterLoss(gameSession, attacker);
        }

        combat.attacker.life = attacker.life;
        combat.defender.life = defender.life;
        combat.attacker.victories = attacker.victories ?? 0;
        combat.defender.victories = defender.victories ?? 0;
        combat.attacker.position = attacker.position;
        combat.defender.position = defender.position;

        return {
            combat,
            result: {
                attackerId: attacker.id,
                defenderId: defender.id,
                winnerId,
                loserIds,
                attackerVictories: attacker.victories ?? 0,
                defenderVictories: defender.victories ?? 0,
                attackerLife: attacker.life,
                defenderLife: defender.life,
                attackerPosition: attacker.position,
                defenderPosition: defender.position,
                activePlayerWon: winnerId === combat.activePlayerId,
                remainingActions: attacker.remainingActions ?? 0,
            },
        };
    }

    resolveAbandon(gameSession: GameSession, combat: CombatState, leavingPlayerId: string): CombatResultPayload | null {
        const winnerId = combat.attacker.id === leavingPlayerId ? combat.defender.id : combat.attacker.id;
        const winner = this.findCharacter(gameSession, winnerId);
        if (!winner) return null;

        winner.victories = (winner.victories ?? 0) + 1;
        return this.buildAbandonResultPayload(gameSession, combat, winner, leavingPlayerId);
    }

    executeCombat(
        gameSession: GameSession,
        attacker: Character,
        defender: Character,
        mapConfig: GameMap | null,
    ): CombatResult {
        if (attacker.remainingActions !== undefined && attacker.remainingActions > 0) {
            attacker.remainingActions -= 1;
        }

        attacker.victories++;

        const isGameWon = attacker.victories >= this.victoriesToWin;

        if (defender.hasFlag && gameSession.gameMode === 'ctf') {
            gameSession.dropFlag(defender.position);
        }

        const newPosition = this.getDefenderRespawnPosition(gameSession, defender, mapConfig);

        defender.position = newPosition;

        return {
            winner: attacker.id,
            loser: defender.id,
            attackerVictories: attacker.victories,
            defenderKnockedDown: true,
            gameWon: isGameWon,
        };
    }

    private getDefenderRespawnPosition(
        gameSession: GameSession,
        defender: Character,
        mapConfig: GameMap | null,
    ): Position {
        if (!mapConfig) {
            throw new Error('Map configuration is required to resolve defender respawn position');
        }

        const defenderStartingPoint = gameSession.getStartingPoint(defender.id);

        if (!defenderStartingPoint) {
            throw new Error(`No starting point found for player ${defender.id}`);
        }

        const occupiedPositions: Position[] = gameSession.players
            .filter(p => p.character.id !== defender.id)
            .map(p => p.character.position);

        const isStartingPointOccupied = occupiedPositions.some(
            p => p.x === defenderStartingPoint.x && p.y === defenderStartingPoint.y,
        );

        if (!isStartingPointOccupied) {
            return defenderStartingPoint;
        }

        return this.startingPointService.getAfterCombatPosition(
            defenderStartingPoint,
            mapConfig,
            occupiedPositions,
        );
    }

    checkGameWinCondition(players: Character[]): Character | null {
        return players.find((player) => (player.victories ?? 0) >= this.victoriesToWin) ?? null;
    }

    getCombatInfo(attacker: Character, defender: Character): CombatInfo {
        return {
            attacker: {
                id: attacker.id,
                name: attacker.name,
                avatarId: attacker.avatarId,
                victories: attacker.victories ?? 0,
            },
            defender: {
                id: defender.id,
                name: defender.name,
                avatarId: defender.avatarId,
                victories: defender.victories ?? 0,
            },
        };
    }

    private toCombatPlayer(player: Character): CombatPlayerState {
        return {
            id: player.id,
            name: player.name,
            avatarId: player.avatarId,
            life: player.life,
            maxLife: player.maxLife,
            attack: player.attack,
            defense: player.defense,
            attackDice: player.attackDice,
            defenseDice: player.defenseDice,
            victories: player.victories ?? 0,
            position: player.position,
            posture: CombatPosture.None,
            hasChosen: false,
        };
    }

    private buildRoundDetail(
        gameSession: GameSession,
        combat: CombatState,
        attacker: Character,
        defender: Character,
        debugMode: boolean,
    ): CombatRoundDetail {
        const attackerPenalty = this.getPenalty(gameSession, attacker.id);
        const defenderPenalty = this.getPenalty(gameSession, defender.id);
        const attackerAttack = this.score({
            base: attacker.attack,
            getsPostureBonus: combat.attacker.posture === CombatPosture.Offensive,
            dice: attacker.attackDice,
            penalty: attackerPenalty,
            debugMode,
            isInstigatorSide: true,
        });
        const attackerDefense = this.score({
            base: attacker.defense,
            getsPostureBonus: combat.attacker.posture === CombatPosture.Defensive,
            dice: attacker.defenseDice,
            penalty: attackerPenalty,
            debugMode,
            isInstigatorSide: true,
        });
        const defenderAttack = this.score({
            base: defender.attack,
            getsPostureBonus: combat.defender.posture === CombatPosture.Offensive,
            dice: defender.attackDice,
            penalty: defenderPenalty,
            debugMode,
            isInstigatorSide: false,
        });
        const defenderDefense = this.score({
            base: defender.defense,
            getsPostureBonus: combat.defender.posture === CombatPosture.Defensive,
            dice: defender.defenseDice,
            penalty: defenderPenalty,
            debugMode,
            isInstigatorSide: false,
        });

        return {
            attackerAttack,
            attackerDefense,
            defenderAttack,
            defenderDefense,
            damageToAttacker: Math.max(0, defenderAttack.total - attackerDefense.total),
            damageToDefender: Math.max(0, attackerAttack.total - defenderDefense.total),
        };
    }

    private score(params: {
        base: number;
        getsPostureBonus: boolean;
        dice: Dice;
        penalty: number;
        debugMode: boolean;
        isInstigatorSide: boolean;
    }): CombatScoreDetail {
        const { base, getsPostureBonus, dice, penalty, debugMode, isInstigatorSide } = params;
        const diceValue = this.rollDice(dice, debugMode, isInstigatorSide);
        const postureBonus = getsPostureBonus ? this.postureBonus : 0;
        return { base, postureBonus, dice: diceValue, penalty, total: base + postureBonus + diceValue + penalty };
    }

    private rollDice(dice: Dice, debugMode: boolean, isInstigatorSide: boolean): number {
        const max = dice === Dice.D4 ? CombatService.d4Max : CombatService.d6Max;
        if (debugMode) return isInstigatorSide ? max : 1;
        return Math.floor(Math.random() * max) + 1;
    }

    private buildAbandonResultPayload(
        gameSession: GameSession, combat: CombatState, winner: Character, leavingPlayerId: string,
    ): CombatResultPayload {
        const attacker = this.findCharacter(gameSession, combat.attacker.id);
        const defender = this.findCharacter(gameSession, combat.defender.id);
        const activePlayer = this.findCharacter(gameSession, combat.activePlayerId);

        return {
            attackerId: combat.attacker.id,
            defenderId: combat.defender.id,
            winnerId: winner.id,
            loserIds: [leavingPlayerId],
            attackerVictories: attacker?.victories ?? 0,
            defenderVictories: defender?.victories ?? 0,
            attackerLife: attacker?.life ?? combat.attacker.life,
            defenderLife: defender?.life ?? combat.defender.life,
            attackerPosition: attacker?.position,
            defenderPosition: defender?.position,
            activePlayerWon: winner.id === combat.activePlayerId,
            remainingActions: activePlayer?.remainingActions ?? 0,
        };
    }

    private getPenalty(gameSession: GameSession, playerId: string): number {
        const player = this.findCharacter(gameSession, playerId);
        if (!player?.position) return 0;
        return gameSession.getMapCopy()?.tiles?.[player.position.y]?.[player.position.x]?.type === TileType.Ice ? this.icePenalty : 0;
    }

    private resetAfterLoss(gameSession: GameSession, player: Character): void {
        const mapConfig = gameSession.getMapCopy();
        player.life = player.maxLife;
        if (mapConfig) player.position = this.getRespawnPosition(gameSession, player, mapConfig);
    }

    private getRespawnPosition(gameSession: GameSession, player: Character, mapConfig: GameMap): Position {
        const startingPoint = gameSession.getStartingPoint(player.id);
        if (!startingPoint) throw new Error(`No starting point found for player ${player.id}`);

        const occupiedPositions = gameSession.players
            .filter((p) => p.character.id !== player.id)
            .map((p) => p.character.position)
            .filter((position): position is Position => !!position);

        const occupied = occupiedPositions.some((position) => position.x === startingPoint.x && position.y === startingPoint.y);

        return occupied
            ? this.startingPointService.getAfterCombatPosition(startingPoint, mapConfig, occupiedPositions)
            : startingPoint;
    }

    private getCombatPlayer(combat: CombatState, playerId: string): CombatPlayerState | undefined {
        return combat.attacker.id === playerId ? combat.attacker : combat.defender.id === playerId ? combat.defender : undefined;
    }

    private findCharacter(gameSession: GameSession, playerId: string): Character | undefined {
        return gameSession.players.find((player) => player.character.id === playerId)?.character;
    }
}

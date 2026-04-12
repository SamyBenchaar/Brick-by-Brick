import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { formatCombatRoundLog } from '@app/services/log/combat-log.util';
import { Character } from '@common/character';
import { ActiveCombat, COMBAT_POSTURE, CombatOutcome, CombatRoundResolvedPayload, CombatValueDetail } from '@common/combat';
import { COMBAT_TURN_TIME } from '@common/constants/combat-constants';
import { Dice, DICE_FACES_MAP } from '@common/dice';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { TileType } from '@common/map';
import { Player } from '@common/player';
import { Position } from '@common/position';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

type CombatParticipants = {
    attacker: Character;
    defender: Character;
    requestingPlayer: Player;
};

type CombatRoundDetails = {
    attackerAttackDetail: CombatValueDetail;
    attackerDefenseDetail: CombatValueDetail;
    defenderAttackDetail: CombatValueDetail;
    defenderDefenseDetail: CombatValueDetail;
    damageToDefender: number;
    damageToAttacker: number;
};

type CombatEndState = {
    attacker: Character;
    defender: Character;
    winner: Character | null;
    loserIds: string[];
    outcome: 'attacker' | 'defender' | 'draw';
    attackerPosition: Position;
    defenderPosition: Position;
    turnShouldContinue: boolean;
};

@Injectable()
export class GamePlayCombatHandler {
    private readonly iceTilePenalty = -2;

    constructor(
        private readonly logger: Logger,
        private readonly gameSessionService: GameSessionService,
        private readonly turnManagementService: TurnManagementService,
    ) {}

    handleRequestCombat(
        socket: Socket,
        payload: { roomId: string; defenderId: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || this.isCombatUnavailable(gameSession)) {
            return;
        }

        const participants = this.getCombatParticipantsFromRequest(gameSession, socket.id, payload.defenderId);
        if (!participants || !this.canStartCombat(gameSession, participants)) {
            return;
        }

        try {
            this.initiateActiveCombat(gameSession, participants.defender.id, participants.attacker, context);
            context.logService.log(
                gameSession.roomId,
                `Début de combat: ${participants.requestingPlayer.character.name} attaque ${participants.defender.name}`,
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Combat error: ${errorMessage}`);
        }
    }

    handlePostureChosen(
        socket: Socket,
        payload: { roomId: string; posture: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) {
            return;
        }

        const combat = gameSession.getActiveCombat();
        if (!combat) {
            return;
        }

        const player = gameSession.players.find((currentPlayer) => currentPlayer.socketId === socket.id);
        if (!player) {
            return;
        }

        this.applyChosenPosture(combat, player.character.id, payload.posture);

        if (this.areBothPosturesChosen(combat)) {
            this.turnManagementService.stopCombatTimer(gameSession.roomId);
            this.resolveCombatRound(gameSession, context);
        }
    }

    private isCombatUnavailable(gameSession: GameSession): boolean {
        return gameSession.isTurnStarting || gameSession.getActiveCombat() !== null;
    }

    private getCombatParticipantsFromRequest(
        gameSession: GameSession,
        socketId: string,
        defenderId: string,
    ): CombatParticipants | null {
        const attacker = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find((player) => player.socketId === socketId);
        const defender = gameSession.players.find((player) => player.character.id === defenderId)?.character;

        if (!attacker || !requestingPlayer || !defender) {
            return null;
        }

        return { attacker, defender, requestingPlayer };
    }

    private canStartCombat(gameSession: GameSession, participants: CombatParticipants): boolean {
        return this.isRequesterCurrentPlayer(participants) &&
            this.hasRemainingCombatAction(participants.attacker) &&
            this.areCombatantsAdjacent(participants.attacker, participants.defender) &&
            !this.areAlliesInCtf(gameSession, participants.attacker, participants.defender);
    }

    private isRequesterCurrentPlayer(participants: CombatParticipants): boolean {
        return participants.attacker.id === participants.requestingPlayer.character.id;
    }

    private hasRemainingCombatAction(attacker: Character): boolean {
        return (attacker.remainingActions ?? 0) > 0;
    }

    private areCombatantsAdjacent(attacker: Character, defender: Character): boolean {
        const horizontalDistance = Math.abs(attacker.position.x - defender.position.x);
        const verticalDistance = Math.abs(attacker.position.y - defender.position.y);

        return horizontalDistance + verticalDistance === 1;
    }

    private areAlliesInCtf(gameSession: GameSession, attacker: Character, defender: Character): boolean {
        const isCtfMode = gameSession.gameMode === 'ctf';
        const bothTeamsKnown = !!attacker.team && !!defender.team;

        return isCtfMode && bothTeamsKnown && attacker.team === defender.team;
    }

    private initiateActiveCombat(
        gameSession: GameSession,
        defenderId: string,
        attacker: Character,
        context: GamePlayHandlerContext,
    ): void {
        const defender = gameSession.players.find((player) => player.character.id === defenderId)?.character;
        if (!defender) {
            return;
        }

        const activeCombat: ActiveCombat = {
            attackerId: attacker.id,
            defenderId,
            initiatorId: attacker.id,
            roundNumber: 1,
            attackerPosture: undefined,
            defenderPosture: undefined,
            attackerHp: attacker.life,
            defenderHp: defender.life,
        };

        attacker.remainingActions = Math.max((attacker.remainingActions ?? 1) - 1, 0);
        gameSession.setActiveCombat(activeCombat);
        this.turnManagementService.pauseTurnTimer(gameSession.roomId);
        gameSession.setCurrentCombatTurnTime(COMBAT_TURN_TIME);

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatStarted, {
            ...activeCombat,
            remainingTurnTime: gameSession.getCurrentTurnTime(),
        });

        this.startCombatTurnTimer(gameSession, context);
    }

    private applyChosenPosture(combat: ActiveCombat, playerId: string, posture: string): void {
        if (playerId === combat.attackerId) {
            combat.attackerPosture = posture;
            return;
        }

        if (playerId === combat.defenderId) {
            combat.defenderPosture = posture;
        }
    }

    private areBothPosturesChosen(combat: ActiveCombat): boolean {
        return !!combat.attackerPosture && !!combat.defenderPosture;
    }

    private handleCombatTimeout(gameSession: GameSession, context: GamePlayHandlerContext): void {
        const combat = gameSession.getActiveCombat();
        if (!combat) {
            return;
        }

        this.resolveCombatRound(gameSession, context);
    }

    private resolveCombatRound(gameSession: GameSession, context?: GamePlayHandlerContext): void {
        const combat = gameSession.getActiveCombat();
        if (!combat) {
            return;
        }

        const attacker = gameSession.getCharacterById(combat.attackerId);
        const defender = gameSession.getCharacterById(combat.defenderId);
        if (!attacker || !defender) {
            return;
        }

        const roundDetails = this.buildRoundDetails(gameSession, combat, attacker, defender);
        this.applyRoundDamage(combat, roundDetails);

        const payload = this.buildRoundResolvedPayload(combat, roundDetails);
        this.logCombatRound(gameSession, attacker, defender, payload, roundDetails, context);

        const outcome = this.getCombatOutcome(combat);
        if (outcome !== null) {
            if (context) {
                this.endCombat(gameSession, outcome, context);
            }
            return;
        }

        this.prepareNextCombatRound(gameSession, combat, payload, context);
    }

    private buildRoundDetails(
        gameSession: GameSession,
        combat: ActiveCombat,
        attacker: Character,
        defender: Character,
    ): CombatRoundDetails {
        const attackerAttackDetail = this.calculateCombatScore(gameSession, attacker, combat, true, true);
        const attackerDefenseDetail = this.calculateCombatScore(gameSession, attacker, combat, false, true);
        const defenderAttackDetail = this.calculateCombatScore(gameSession, defender, combat, true, false);
        const defenderDefenseDetail = this.calculateCombatScore(gameSession, defender, combat, false, false);

        const damageToDefender = Math.max(attackerAttackDetail.total - defenderDefenseDetail.total, 0);
        const damageToAttacker = Math.max(defenderAttackDetail.total - attackerDefenseDetail.total, 0);

        return {
            attackerAttackDetail,
            attackerDefenseDetail,
            defenderAttackDetail,
            defenderDefenseDetail,
            damageToDefender,
            damageToAttacker,
        };
    }

    private applyRoundDamage(combat: ActiveCombat, roundDetails: CombatRoundDetails): void {
        combat.attackerHp = Math.max(combat.attackerHp - roundDetails.damageToAttacker, 0);
        combat.defenderHp = Math.max(combat.defenderHp - roundDetails.damageToDefender, 0);
    }

    private buildRoundResolvedPayload(
        combat: ActiveCombat,
        roundDetails: CombatRoundDetails,
    ): CombatRoundResolvedPayload {
        return {
            roundNumber: combat.roundNumber,
            attackerId: combat.attackerId,
            defenderId: combat.defenderId,
            attackerChoice: combat.attackerPosture || COMBAT_POSTURE.NONE,
            defenderChoice: combat.defenderPosture || COMBAT_POSTURE.NONE,
            attackerStrike: {
                attack: roundDetails.attackerAttackDetail,
                defense: roundDetails.defenderDefenseDetail,
                damage: roundDetails.damageToDefender,
            },
            defenderStrike: {
                attack: roundDetails.defenderAttackDetail,
                defense: roundDetails.attackerDefenseDetail,
                damage: roundDetails.damageToAttacker,
            },
            attackerLife: combat.attackerHp,
            defenderLife: combat.defenderHp,
        };
    }

    private logCombatRound(
        gameSession: GameSession,
        attacker: Character,
        defender: Character,
        payload: CombatRoundResolvedPayload,
        roundDetails: CombatRoundDetails,
        context?: GamePlayHandlerContext,
    ): void {
        if (!context) {
            return;
        }

        const roundOutcome = this.determineRoundWinner(
            roundDetails.damageToAttacker,
            roundDetails.damageToDefender,
        );

        const logMessage = formatCombatRoundLog(payload, attacker, defender, roundOutcome);
        const playersInvolved = [attacker.name, defender.name];

        context.logService.log(gameSession.roomId, logMessage, 'combat', playersInvolved);
    }

    private getCombatOutcome(combat: ActiveCombat): 'attacker' | 'defender' | 'draw' | null {
        const attackerDefeated = combat.attackerHp === 0;
        const defenderDefeated = combat.defenderHp === 0;

        if (attackerDefeated && defenderDefeated) {
            return 'draw';
        }

        if (defenderDefeated) {
            return 'attacker';
        }

        if (attackerDefeated) {
            return 'defender';
        }

        return null;
    }

    private determineRoundWinner(damageToAttacker: number, damageToDefender: number): CombatOutcome {
        if (damageToDefender > damageToAttacker) {
            return 'attacker';
        }

        if (damageToAttacker > damageToDefender) {
            return 'defender';
        }

        return 'draw';
    }

    private prepareNextCombatRound(
        gameSession: GameSession,
        combat: ActiveCombat,
        payload: CombatRoundResolvedPayload,
        context?: GamePlayHandlerContext,
    ): void {
        combat.roundNumber += 1;
        combat.attackerPosture = undefined;
        combat.defenderPosture = undefined;

        if (!context) {
            return;
        }

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatRoundResolved, payload);
        gameSession.setCurrentCombatTurnTime(COMBAT_TURN_TIME);
        this.startCombatTurnTimer(gameSession, context);
    }

    private endCombat(
        gameSession: GameSession,
        outcome: 'attacker' | 'defender' | 'draw',
        context: GamePlayHandlerContext,
    ): void {
        this.turnManagementService.stopCombatTimer(gameSession.roomId);

        const combat = gameSession.getActiveCombat();
        if (!combat) {
            return;
        }

        const attacker = gameSession.getCharacterById(combat.attackerId);
        const defender = gameSession.getCharacterById(combat.defenderId);
        if (!attacker || !defender) {
            return;
        }

        const combatState = this.buildCombatEndState(gameSession, attacker, defender, combat, outcome);
        gameSession.clearActiveCombat();

        this.emitCombatResult(gameSession, combatState, context);
        this.logCombatResult(gameSession, combatState, context);

        const gameWinner = this.gameSessionService.checkGameWinner(gameSession);
        if (gameWinner) {
            context.onGameEnd(gameSession, gameWinner);
            return;
        }

        this.resumeOrEndTurn(gameSession, combatState.turnShouldContinue, context);
    }

    private buildCombatEndState(
        gameSession: GameSession,
        attacker: Character,
        defender: Character,
        combat: ActiveCombat,
        outcome: 'attacker' | 'defender' | 'draw',
    ): CombatEndState {
        const attackerDefeated = outcome === 'defender' || outcome === 'draw';
        const defenderDefeated = outcome === 'attacker' || outcome === 'draw';
        const winner = this.getWinnerFromOutcome(outcome, attacker, defender);

        if (!attackerDefeated) {
            attacker.life = combat.attackerHp;
        }

        if (!defenderDefeated) {
            defender.life = combat.defenderHp;
        }

        if (winner) {
            winner.victories = (winner.victories ?? 0) + 1;
        }

        const attackerPosition = attackerDefeated
            ? this.respawnDefeatedPlayer(gameSession, attacker)
            : attacker.position;

        const defenderPosition = defenderDefeated
            ? this.respawnDefeatedPlayer(gameSession, defender)
            : defender.position;

        const turnShouldContinue = outcome === 'attacker' && (attacker.remainingMovement ?? 0) > 0;

        return {
            attacker,
            defender,
            winner,
            loserIds: this.getLoserIds(attacker, defender, attackerDefeated, defenderDefeated),
            outcome,
            attackerPosition,
            defenderPosition,
            turnShouldContinue,
        };
    }

    private getWinnerFromOutcome(
        outcome: 'attacker' | 'defender' | 'draw',
        attacker: Character,
        defender: Character,
    ): Character | null {
        if (outcome === 'attacker') {
            return attacker;
        }

        if (outcome === 'defender') {
            return defender;
        }

        return null;
    }

    private getLoserIds(
        attacker: Character,
        defender: Character,
        attackerDefeated: boolean,
        defenderDefeated: boolean,
    ): string[] {
        const loserIds: string[] = [];

        if (attackerDefeated) {
            loserIds.push(attacker.id);
        }

        if (defenderDefeated) {
            loserIds.push(defender.id);
        }

        return loserIds;
    }

    private respawnDefeatedPlayer(gameSession: GameSession, player: Character): Position {
        const defeatPosition = { ...player.position };

        this.dropFlagIfNeeded(gameSession, player, defeatPosition);

        const respawnPosition = this.getRespawnPosition(gameSession, player);
        player.position = respawnPosition;
        player.life = player.maxLife;

        return respawnPosition;
    }

    private dropFlagIfNeeded(gameSession: GameSession, player: Character, defeatPosition: Position): void {
        if (!player.hasFlag || gameSession.gameMode !== 'ctf') {
            return;
        }

        const dropPosition = this.getFlagDropPosition(gameSession, defeatPosition);
        if (dropPosition) {
            gameSession.dropFlag(dropPosition);
        }
    }

    private getRespawnPosition(gameSession: GameSession, player: Character): Position {
        const startingPoint = gameSession.getStartingPoint(player.id);
        if (!startingPoint) {
            return player.position;
        }

        const startingPointIsFree = this.isPositionFree(gameSession, startingPoint, player.id);
        if (startingPointIsFree) {
            return startingPoint;
        }

        return this.gameSessionService.findNearestFreeTile(gameSession, startingPoint) ?? startingPoint;
    }

    private isPositionFree(gameSession: GameSession, position: Position, excludedPlayerId: string): boolean {
        return !gameSession.players.some((otherPlayer) =>
            otherPlayer.character.id !== excludedPlayerId &&
            otherPlayer.character.position.x === position.x &&
            otherPlayer.character.position.y === position.y,
        );
    }

    private getFlagDropPosition(gameSession: GameSession, defeatPosition: Position): Position | null {
        const tile = gameSession.getMapCopy()?.tiles?.[defeatPosition.y]?.[defeatPosition.x];
        if (!tile) {
            return null;
        }

        const defeatedOnOpenedDoor = tile.type === TileType.Door && tile.doorState === 'opened';
        if (defeatedOnOpenedDoor) {
            return this.gameSessionService.findNearestFreeTile(gameSession, defeatPosition);
        }

        return defeatPosition;
    }

    private emitCombatResult(
        gameSession: GameSession,
        combatState: CombatEndState,
        context: GamePlayHandlerContext,
    ): void {
        context.server.to(gameSession.roomId).emit(CombatEvents.CombatResult, {
            attackerId: combatState.attacker.id,
            defenderId: combatState.defender.id,
            winnerId: combatState.winner?.id ?? null,
            loserIds: combatState.loserIds,
            outcome: combatState.outcome,
            attackerPosition: combatState.attackerPosition,
            defenderPosition: combatState.defenderPosition,
            attackerLife: combatState.attacker.life,
            defenderLife: combatState.defender.life,
            attackerVictories: combatState.attacker.victories,
            defenderVictories: combatState.defender.victories,
            remainingActions: combatState.attacker.remainingActions,
            remainingTurnTime: gameSession.getCurrentTurnTime(),
            turnShouldContinue: combatState.turnShouldContinue,
            flagPosition: gameSession.gameMode === 'ctf' ? gameSession.getFlagPosition() : null,
            flagHolderId: gameSession.gameMode === 'ctf' ? gameSession.getFlagHolder() : null,
        });

        if (gameSession.gameMode === 'ctf') {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        context.emitReachableTiles(gameSession);
    }

    private logCombatResult(
        gameSession: GameSession,
        combatState: Pick<CombatEndState, 'attacker' | 'defender' | 'winner' | 'outcome'>,
        context: GamePlayHandlerContext,
    ): void {
        if (combatState.outcome === 'draw') {
            context.logService.log(
                gameSession.roomId,
                `Fin du combat: ${combatState.attacker.name} et ${combatState.defender.name} sont tous deux vaincus`,
            );
            return;
        }

        if (!combatState.winner) {
            return;
        }

        const loser = combatState.winner.id === combatState.attacker.id ? combatState.defender : combatState.attacker;
        context.logService.log(
            gameSession.roomId,
            `Fin du combat: ${combatState.winner.name} a gagné contre ${loser.name}`,
        );
    }

    private resumeOrEndTurn(
        gameSession: GameSession,
        turnShouldContinue: boolean,
        context: GamePlayHandlerContext,
    ): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        if (!currentPlayer || !turnShouldContinue) {
            this.gameSessionService.endCurrentTurn(gameSession);
            context.onTurnEnd(gameSession);
            return;
        }

        this.turnManagementService.resumeTurnTimer(
            gameSession,
            () => {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            },
            (timeRemaining: number) => {
                context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnTimeUpdate, {
                    timeRemaining,
                });
            },
        );

        context.server.to(gameSession.roomId).emit(GameSessionEvents.TurnStarted, {
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            turnTime: gameSession.getCurrentTurnTime(),
            remainingMovement: currentPlayer.remainingMovement,
            remainingActions: currentPlayer.remainingActions,
        });
    }

    private startCombatTurnTimer(gameSession: GameSession, context: GamePlayHandlerContext): void {
        context.server.to(gameSession.roomId).emit(CombatEvents.CombatTurnStarted, {
            timeRemaining: gameSession.getCurrentCombatTurnTime(),
        });

        this.turnManagementService.startCombatTimer(
            gameSession,
            () => {
                this.handleCombatTimeout(gameSession, context);
            },
            (timeRemaining: number) => {
                context.server.to(gameSession.roomId).emit(CombatEvents.CombatTurnTimeUpdate, {
                    timeRemaining,
                });
            },
        );
    }

    private calculateCombatScore(
        gameSession: GameSession,
        character: Character,
        combat: ActiveCombat,
        isAttackMode: boolean,
        isAttacker: boolean,
    ): CombatValueDetail {
        const posture = isAttacker ? combat.attackerPosture : combat.defenderPosture;
        const attackBonus = posture === COMBAT_POSTURE.OFFENSIVE ? 2 : 0;
        const defenseBonus = posture === COMBAT_POSTURE.DEFENSIVE ? 2 : 0;

        const baseStat = isAttackMode ? character.attack : character.defense;
        const postureBonus = isAttackMode ? attackBonus : defenseBonus;
        const tilePenalty = this.getTilePenalty(gameSession, character);

        const diceRoll = isAttackMode
            ? this.rollDice(character.attackDice, isAttacker, gameSession.isDebugModeActivated)
            : this.rollDice(character.defenseDice, isAttacker, gameSession.isDebugModeActivated);

        const total = baseStat + postureBonus + tilePenalty + diceRoll;

        return {
            base: baseStat,
            postureBonus,
            dice: diceRoll,
            tilePenalty,
            total,
        };
    }

    private getTilePenalty(gameSession: GameSession, player: Character): number {
        const tile = gameSession.getMapCopy()?.tiles?.[player.position.y]?.[player.position.x];
        if (!tile) {
            return 0;
        }

        return tile.type === TileType.Ice ? this.iceTilePenalty : 0;
    }

    private rollDice(dice: Dice, isAttacker: boolean, debugMode = false): number {
        if (debugMode) {
            return isAttacker ? DICE_FACES_MAP[dice] : 1;
        }

        const faces = DICE_FACES_MAP[dice];
        return Math.floor(Math.random() * faces) + 1;
    }
}
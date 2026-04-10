import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { Character } from '@common/character';
import { ActiveCombat, COMBAT_POSTURE, CombatRoundResolvedPayload, CombatValueDetail } from '@common/combat';
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
        const activeCombat: ActiveCombat = {
            attackerId: attacker.id,
            defenderId,
            initiatorId: attacker.id,
            roundNumber: 1,
            attackerPosture: undefined,
            defenderPosture: undefined,
            attackerHp: attacker.life,
            defenderHp: gameSession.players.find(p => p.character.id === defenderId)?.character.life ?? 0,
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

    handlePostureChosen(
        socket: Socket,
        payload: { roomId: string; posture: string },
        context: GamePlayHandlerContext,
    ) {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession) return;

        const combat = gameSession.getActiveCombat();
        if (!combat) return;

        const player = gameSession.players.find(p => p.socketId === socket.id);
        if (!player) return;

        const playerId = player.character.id;

        if (playerId === combat.attackerId) {
            combat.attackerPosture = payload.posture;
        } else if (playerId === combat.defenderId) {
            combat.defenderPosture = payload.posture;
        }

        if (combat.attackerPosture && combat.defenderPosture) {
            this.turnManagementService.stopCombatTimer(gameSession.roomId);
            this.resolveCombatRound(gameSession, context);
        }
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

        const outcome = this.getCombatOutcome(combat);
        if (outcome !== null) {
            if (context) {
                this.endCombat(gameSession, outcome, context);
            }
            return;
        }

        this.prepareNextCombatRound(gameSession, combat, roundDetails, context);
    }

    private buildRoundDetails(
        gameSession: GameSession,
        combat: ActiveCombat,
        attacker: Character,
        defender: Character,
    ): {
        attackerAttackDetail: CombatValueDetail;
        attackerDefenseDetail: CombatValueDetail;
        defenderAttackDetail: CombatValueDetail;
        defenderDefenseDetail: CombatValueDetail;
        damageToDefender: number;
        damageToAttacker: number;
    } {
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

    private applyRoundDamage(
        combat: ActiveCombat,
        roundDetails: {
            damageToDefender: number;
            damageToAttacker: number;
        },
    ): void {
        combat.attackerHp = Math.max(combat.attackerHp - roundDetails.damageToAttacker, 0);
        combat.defenderHp = Math.max(combat.defenderHp - roundDetails.damageToDefender, 0);
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

    private prepareNextCombatRound(
        gameSession: GameSession,
        combat: ActiveCombat,
        roundDetails: {
            attackerAttackDetail: CombatValueDetail;
            attackerDefenseDetail: CombatValueDetail;
            defenderAttackDetail: CombatValueDetail;
            defenderDefenseDetail: CombatValueDetail;
            damageToDefender: number;
            damageToAttacker: number;
        },
        context?: GamePlayHandlerContext,
    ): void {
        const payload: CombatRoundResolvedPayload = {
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

    private endCombat(gameSession: GameSession, winnerId: string, loserId: string, context: GamePlayHandlerContext): void {
        this.turnManagementService.stopCombatTimer(gameSession.roomId);

        const participants = this.getCombatParticipants(gameSession, winnerId, loserId);
        if (!participants) {
            return;
        }

        const { winner, loser, attacker } = participants;
        this.applyCombatOutcome(gameSession, winner, loser, attacker);
        this.emitCombatOutcome({
            gameSession,
            winnerId,
            loserId,
            winner,
            loser,
            attacker,
            context,
        });

        const gameWinner = this.gameSessionService.checkGameWinner(gameSession);
        if (gameWinner) {
            context.onGameEnd(gameSession, gameWinner);
            return;
        }

        this.resumeOrEndTurn(gameSession, winner, context);
    }

    private getCombatParticipants(
        gameSession: GameSession,
        winnerId: string,
        loserId: string,
    ): { winner: Character; loser: Character; attacker: Character } | null {
        const winner = gameSession.getCharacterById(winnerId);
        const loser = gameSession.getCharacterById(loserId);
        const attacker = gameSession.getCharacterById(gameSession.getActiveCombat()?.attackerId ?? '');

        if (!winner || !loser || !attacker) {
            return null;
        }

        return { winner, loser, attacker };
    }

    private applyCombatOutcome(gameSession: GameSession, winner: Character, loser: Character, attacker: Character): void {
        attacker.remainingActions = Math.max((attacker.remainingActions ?? 1) - 1, 0);
        winner.victories = (winner.victories ?? 0) + 1;

        if (loser.hasFlag && gameSession.gameMode === 'ctf') {
            gameSession.dropFlag(loser.position);
        }

        const startingPoint = gameSession.getStartingPoint(loser.id);
        if (startingPoint) {
            loser.position = startingPoint;
        }

        gameSession.clearActiveCombat();
    }

    private emitCombatOutcome(options: {
        gameSession: GameSession;
        winnerId: string;
        loserId: string;
        winner: Character;
        loser: Character;
        attacker: Character;
        context: GamePlayHandlerContext;
    }): void {
        const {
            gameSession,
            winnerId,
            loserId,
            winner,
            loser,
            attacker,
            context,
        } = options;

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatResult, {
            winner: winnerId,
            loser: loserId,
            attackerVictories: winner.victories,
            defenderNewPosition: loser.position,
            remainingActions: attacker.remainingActions,
            flagPosition: gameSession.gameMode === 'ctf' ? gameSession.getFlagPosition() : null,
            flagHolder: gameSession.gameMode === 'ctf' ? gameSession.getFlagHolder() : null,
        });

        context.logService.log(gameSession.roomId, `Fin du combat: ${winner.name} a gagné contre ${loser.name}`);

        if (gameSession.gameMode === 'ctf') {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        context.emitReachableTiles(gameSession);
    }

    private resumeOrEndTurn(gameSession: GameSession, winner: Character, context: GamePlayHandlerContext): void {
        const currentPlayer = gameSession.getCurrentPlayer();
        const shouldResumeTurn = currentPlayer?.id === winner.id && (currentPlayer.remainingMovement ?? 0) > 0;

        if (shouldResumeTurn) {
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
                playerId: currentPlayer?.id,
                playerName: currentPlayer?.name,
                turnTime: gameSession.getCurrentTurnTime(),
                remainingMovement: currentPlayer?.remainingMovement,
                remainingActions: currentPlayer?.remainingActions,
            });
            return;
        }

        this.gameSessionService.endCurrentTurn(gameSession);
        context.onTurnEnd(gameSession);
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

    private calculateCombatScore(gameSession: GameSession, character: Character, combat: ActiveCombat,
        isAttackMode: boolean, isAttacker: boolean): CombatValueDetail {

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
        const tile = gameSession.getMapCopy()?.tiles[player.position.y][player.position.x];

        return tile.type === TileType.Ice ? this.iceTilePenalty : 0;
    }

    private rollDice(dice: Dice, isAttacker: boolean, debugMode: boolean = false): number {
        if (debugMode) {
            return isAttacker ? DICE_FACES_MAP[dice] : 1;
        }

        const faces = DICE_FACES_MAP[dice];
        return Math.floor(Math.random() * faces) + 1;
    }
}

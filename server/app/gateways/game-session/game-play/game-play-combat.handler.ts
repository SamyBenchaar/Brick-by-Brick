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
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';


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
        if (!gameSession) {
            return;
        }

        if (gameSession.isTurnStarting || gameSession.getActiveCombat()) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);
        const defender = gameSession.players.find(p => p.character.id === payload.defenderId)?.character;

        if (!this.validateCombatRequest(currentPlayer, requestingPlayer, defender)) {
            return;
        }

        try {
            this.initiateActiveCombat(gameSession, payload.defenderId, currentPlayer, context);
            context.logService.log(gameSession.roomId, `Début de combat: ${requestingPlayer.character.name} attaque ${defender.name}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Combat error: ${errorMessage}`);
        }
    }

    private validateCombatRequest(currentPlayer: Character | null, requestingPlayer: Player | undefined, defender: Character | undefined): boolean {
        if (!currentPlayer || !requestingPlayer || !defender || currentPlayer.id !== requestingPlayer.character.id) {
            return false;
        }

        if ((currentPlayer.remainingActions ?? 0) <= 0) {
            return false;
        }

        const distance = Math.abs(currentPlayer.position.x - defender.position.x) +
            Math.abs(currentPlayer.position.y - defender.position.y);
        return distance === 1;
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
        if (!combat) return;

        const attacker = gameSession.getCharacterById(combat.attackerId);
        const defender = gameSession.getCharacterById(combat.defenderId);
        if (!attacker || !defender) return;

        const attackerAttackDetail = this.calculateCombatScore(gameSession, attacker, combat, true, true);
        const attackerDefenseDetail = this.calculateCombatScore(gameSession, attacker, combat, false, true);

        const defenderAttackDetail = this.calculateCombatScore(gameSession, defender, combat, true, false);
        const defenderDefenseDetail = this.calculateCombatScore(gameSession, defender, combat, false, false);

        const damageToDefender = Math.max(attackerAttackDetail.total - defenderDefenseDetail.total, 0);
        const damageToAttacker = Math.max(defenderAttackDetail.total - attackerDefenseDetail.total, 0);

        const effectiveDamageToDefender = Math.min(damageToDefender, combat.defenderHp);
        const effectiveDamageToAttacker = Math.min(damageToAttacker, combat.attackerHp);


        combat.attackerHp = Math.max(combat.attackerHp - damageToAttacker, 0);
        combat.defenderHp = Math.max(combat.defenderHp - damageToDefender, 0);

        attacker.totalDamageDealt += effectiveDamageToDefender;
        attacker.totalDamageReceived += effectiveDamageToAttacker;
        defender.totalDamageDealt += effectiveDamageToAttacker;
        defender.totalDamageReceived += effectiveDamageToDefender;


        const combatEnds = combat.attackerHp === 0 || combat.defenderHp === 0;

        const result = this.determineRoundWinner(damageToAttacker, damageToDefender);
        const playersInvolved = [attacker.name, defender.name];

        const payload: CombatRoundResolvedPayload = {
            roundNumber: combat.roundNumber,
            attackerId: combat.attackerId,
            defenderId: combat.defenderId,
            attackerChoice: combat.attackerPosture || COMBAT_POSTURE.NONE,
            defenderChoice: combat.defenderPosture || COMBAT_POSTURE.NONE,
            attackerStrike: {
                attack: attackerAttackDetail,
                defense: defenderDefenseDetail,
                damage: damageToDefender,
            },
            defenderStrike: {
                attack: defenderAttackDetail,
                defense: attackerDefenseDetail,
                damage: damageToAttacker,
            },
            attackerLife: combat.attackerHp,
            defenderLife: combat.defenderHp,
        };

        if (context) {
            const logMessage = formatCombatRoundLog(payload, attacker, defender, result);
            context.logService.log(gameSession.roomId, logMessage, 'combat', playersInvolved);
        }

        if (combatEnds) {
            const winner = combat.attackerHp > 0 ? combat.attackerId : combat.defenderId;
            const loser = combat.attackerHp > 0 ? combat.defenderId : combat.attackerId;

            if (context) {
                this.endCombat(gameSession, winner, loser, context);
            }
        } else {
            combat.roundNumber += 1;
            combat.attackerPosture = undefined;
            combat.defenderPosture = undefined;

            if (context) {
                context.server.to(gameSession.roomId).emit(CombatEvents.CombatRoundResolved, payload);
                gameSession.setCurrentCombatTurnTime(COMBAT_TURN_TIME);
                this.startCombatTurnTimer(gameSession, context);
            }
        }
    }

    private determineRoundWinner(damageToAttacker: number, damageToDefender: number): CombatOutcome {
        if (damageToDefender > damageToAttacker) return 'attacker';
        if (damageToAttacker > damageToDefender) return 'defender';
        return 'draw';
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
        loser.defeats++;

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

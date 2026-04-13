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
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

type RoundWinner = 'attacker' | 'defender' | 'tie';

/* eslint-disable max-lines */

@Injectable()
export class GamePlayCombatHandler {
    private readonly iceTilePenalty = -2;
    private readonly virtualResolveDelayMs = 2000;

    constructor(
        private readonly logger: Logger,
        @Inject(forwardRef(() => GameSessionService))
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

    initiateVirtualPlayerCombat(
        gameSession: GameSession,
        attacker: Character,
        defenderId: string,
        context: GamePlayHandlerContext,
    ): void {
        const defender = gameSession.players.find(p => p.character.id === defenderId)?.character;
        if (!defender || gameSession.isTurnStarting || gameSession.getActiveCombat()) {
            return;
        }

        if ((attacker.remainingActions ?? 0) <= 0) {
            return;
        }

        const distance = Math.abs(attacker.position.x - defender.position.x) + Math.abs(attacker.position.y - defender.position.y);
        if (distance !== 1) {
            return;
        }

        try {
            this.initiateActiveCombat(gameSession, defenderId, attacker, context);
            context.logService.log(gameSession.roomId, `Début de combat: ${attacker.name} attaque ${defender.name}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Combat error: ${errorMessage}`);
        }
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

        this.autoSelectVirtualPlayerPostures(gameSession, activeCombat);

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatStarted, {
            ...activeCombat,
            remainingTurnTime: gameSession.getCurrentTurnTime(),
        });

        this.startCombatTurnTimer(gameSession, context);

        if (activeCombat.attackerPosture && activeCombat.defenderPosture) {
            this.handleAllVirtualPlayersResolve(gameSession, context);
        }
    }

    private autoSelectVirtualPlayerPostures(
        gameSession: GameSession,
        combat: ActiveCombat,
    ): void {
        const attackerPlayer = gameSession.players.find(p => p.character.id === combat.attackerId);
        const defenderPlayer = gameSession.players.find(p => p.character.id === combat.defenderId);

        if (attackerPlayer?.virtualProfile) {
            combat.attackerPosture = attackerPlayer.virtualProfile === 'aggressive' ? COMBAT_POSTURE.OFFENSIVE : COMBAT_POSTURE.DEFENSIVE;
        }
        if (defenderPlayer?.virtualProfile) {
            combat.defenderPosture = defenderPlayer.virtualProfile === 'aggressive' ? COMBAT_POSTURE.OFFENSIVE : COMBAT_POSTURE.DEFENSIVE;
        }
    }

    private handleAllVirtualPlayersResolve(gameSession: GameSession, context: GamePlayHandlerContext): void {
        setTimeout(() => {
            const session = this.gameSessionService.getGameSession(gameSession.roomId);
            if (session && session.getActiveCombat()) {
                this.turnManagementService.stopCombatTimer(session.roomId);
                this.resolveCombatRound(session, context);
            }
        }, this.virtualResolveDelayMs);
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

    // eslint-disable-next-line complexity
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

        combat.attackerHp = Math.max(combat.attackerHp - damageToAttacker, 0);
        combat.defenderHp = Math.max(combat.defenderHp - damageToDefender, 0);

        const combatEnds = combat.attackerHp === 0 || combat.defenderHp === 0;

        const result = this.determineRoundWinner(damageToAttacker, damageToDefender);
        let logMessage: string;

        switch (result) {
            case 'tie':
                logMessage = `Manche ${combat.roundNumber}: Égalité entre ${attacker.name} et ${defender.name}`;
                break;
            case 'attacker':
                logMessage = `Manche ${combat.roundNumber}: ${attacker.name} remporte la manche contre ${defender.name}`;
                break;
            case 'defender':
                logMessage = `Manche ${combat.roundNumber}: ${defender.name} remporte la manche contre ${attacker.name}`;
                break;
        }
        const playersInvolved = [attacker.name, defender.name];
        context.logService.log(gameSession.roomId, logMessage, 'combat', playersInvolved);

        if (combatEnds) {
            const winner = combat.attackerHp > 0 ? combat.attackerId : combat.defenderId;
            const loser = combat.attackerHp > 0 ? combat.defenderId : combat.attackerId;

            if (context) {
                this.endCombat(gameSession, winner, loser, context);
            }
        } else {
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

            combat.roundNumber += 1;
            combat.attackerPosture = undefined;
            combat.defenderPosture = undefined;

            if (context) {
                context.server.to(gameSession.roomId).emit(CombatEvents.CombatRoundResolved, payload);
                gameSession.setCurrentCombatTurnTime(COMBAT_TURN_TIME);

                this.autoSelectVirtualPlayerPostures(gameSession, combat);

                this.startCombatTurnTimer(gameSession, context);

                if (combat.attackerPosture && combat.defenderPosture) {
                    this.handleAllVirtualPlayersResolve(gameSession, context);
                }
            }
        }
    }

    private determineRoundWinner(damageToAttacker: number, damageToDefender: number): RoundWinner {
        if (damageToDefender > damageToAttacker) return 'attacker';
        if (damageToAttacker > damageToDefender) return 'defender';
        return 'tie';
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

        const total = baseStat + postureBonus - tilePenalty + diceRoll;

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

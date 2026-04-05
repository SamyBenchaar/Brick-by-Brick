import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { ActiveCombat, COMBAT_POSTURE, CombatRoundResolvedPayload, CombatValueDetail } from '@common/combat';
import { Dice, DICE_FACES_MAP } from '@common/dice';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { TileType } from '@common/map';
import { Player } from '@common/player';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GamePlayCombatHandler {
    constructor(
        private readonly logger: Logger,
        private readonly gameSessionService: GameSessionService,
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
            defenderId: defenderId,
            initiatorId: attacker.id,
            roundNumber: 1,
            attackerPosture: undefined,
            defenderPosture: undefined,
            attackerHp: attacker.life,
            defenderHp: gameSession.players.find(p => p.character.id === defenderId)?.character.life ?? 0,
        };

        gameSession.setActiveCombat(activeCombat);

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatStarted, activeCombat);
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
            this.resolveCombatRound(gameSession, context);
        }
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

        combat.attackerHp = Math.max(combat.attackerHp - damageToAttacker, 0);
        combat.defenderHp = Math.max(combat.defenderHp - damageToDefender, 0);

        const combatEnds = combat.attackerHp === 0 || combat.defenderHp === 0;

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
                    damage: damageToDefender
                },
                defenderStrike: {
                    attack: defenderAttackDetail,
                    defense: attackerDefenseDetail,
                    damage: damageToAttacker
                },
                attackerLife: combat.attackerHp,
                defenderLife: combat.defenderHp
            };

            combat.roundNumber += 1;
            combat.attackerPosture = undefined;
            combat.defenderPosture = undefined;

            if (context) {
                context.server.to(gameSession.roomId).emit(CombatEvents.CombatRoundResolved, payload);
            }
        }
    }

    private endCombat(gameSession: GameSession, winnerId: string, loserId: string, context: GamePlayHandlerContext): void {
        const winner = gameSession.getCharacterById(winnerId);
        const loser = gameSession.getCharacterById(loserId);

        if (!winner || !loser) return;

        winner.remainingActions = (winner.remainingActions ?? 1) - 1;
        winner.victories = (winner.victories ?? 0) + 1;

        if (loser.hasFlag && gameSession.gameMode === 'ctf') {
            gameSession.dropFlag(loser.position);
        }

        const startingPoint = gameSession.getStartingPoint(loser.id);
        if (startingPoint) {
            loser.position = startingPoint;
        }

        gameSession.clearActiveCombat();

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatResult, {
            winner: winnerId,
            loser: loserId,
            attackerVictories: winner.victories,
            defenderNewPosition: loser.position,
            remainingActions: winner.remainingActions,
            flagPosition: gameSession.gameMode === 'ctf' ? gameSession.getFlagPosition() : null,
            flagHolder: gameSession.gameMode === 'ctf' ? gameSession.getFlagHolder() : null,
        });

        context.logService.log(gameSession.roomId, `Résultat du combat: ${winner.name} a gagné contre ${loser.name}`);

        if (gameSession.gameMode === 'ctf') {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        context.emitReachableTiles(gameSession);

        const gameWinner = this.gameSessionService.checkGameWinner(gameSession);
        if (gameWinner) {
            context.onGameEnd(gameSession, gameWinner);
            return;
        }

        if (loser.id === gameSession.getCurrentPlayer()?.id) {
            this.gameSessionService.endCurrentTurn(gameSession);
            context.onTurnEnd(gameSession);
        } else {
            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            }
        }
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
            : this.rollDice(character.defenseDice, isAttacker, gameSession.isDebugModeActivated)

        const total = baseStat + postureBonus - tilePenalty + diceRoll;

        return {
            base: baseStat,
            postureBonus,
            dice: diceRoll,
            tilePenalty,
            total
        };
    }

    private getTilePenalty(gameSession: GameSession, player: Character): number {
        const tile = gameSession.getMapCopy()?.tiles[player.position.y][player.position.x];

        return tile.type === TileType.Ice ? -2 : 0;
    }

    private rollDice(dice: Dice, isAttacker: boolean, debugMode: boolean = false): number {
        if (debugMode) {
            return isAttacker ? DICE_FACES_MAP[dice] : 1;
        }

        const faces = DICE_FACES_MAP[dice];
        return Math.floor(Math.random() * faces) + 1;
    }
}

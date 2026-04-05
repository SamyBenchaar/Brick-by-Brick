import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { Character } from '@common/character';
import { GameSessionEvents, CombatEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SubscribeMessage } from '@nestjs/websockets';
import { TileType } from '@common/map';
import { ActiveCombat, COMBAT_POSTURE } from '@common/combat';
import { Dice, DICE_FACES_MAP } from '@common/dice';

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

        if (gameSession.isTurnStarting) {
            return;
        }

        const currentPlayer = gameSession.getCurrentPlayer();
        const requestingPlayer = gameSession.players.find(p => p.socketId === socket.id);

        if (!this.validateCombatRequest(currentPlayer, requestingPlayer)) {
            return;
        }

        try {
            this.executeCombatAndEmit(gameSession, payload.defenderId, currentPlayer, context);
        } catch (error) {
            this.logger.error(`Combat error: ${error.message}`);
        }
    }

    private validateCombatRequest(currentPlayer: Character | null, requestingPlayer: Player | undefined): boolean {
        if (!currentPlayer || !requestingPlayer || currentPlayer.id !== requestingPlayer.character.id) {
            return false;
        }

        if ((currentPlayer.remainingActions ?? 0) <= 0) {
            return false;
        }

        return true;
    }

    private executeCombatAndEmit(
        gameSession: GameSession,
        defenderId: string,
        currentPlayer: Character,
        context: GamePlayHandlerContext,
    ): void {
        const result = this.gameSessionService.executeCombat(gameSession, defenderId);

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatResult, {
            winner: result.winner,
            loser: result.loser,
            attackerVictories: result.attackerVictories,
            defenderNewPosition: gameSession.players.find(p => p.character.id === defenderId)?.character.position,
            remainingActions: currentPlayer.remainingActions,
            flagPosition: gameSession.gameMode === 'ctf' ? gameSession.getFlagPosition() : null,
            flagHolder: gameSession.gameMode === 'ctf' ? gameSession.getFlagHolder() : null,
        });

        const winnerPlayer = gameSession.players.find(p => p.character.id === result.winner)?.character;
        const loserPlayer = gameSession.players.find(p => p.character.id === result.loser)?.character;
        if (winnerPlayer && loserPlayer) {
            context.logService.log(gameSession.roomId, `Résultat du combat: ${winnerPlayer.name} a gagné contre ${loserPlayer.name}`);
        }

        if (gameSession.gameMode === 'ctf') {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }

        context.emitReachableTiles(gameSession);
        const winner = this.gameSessionService.checkGameWinner(gameSession);
        if (winner) {
            context.onGameEnd(gameSession, winner);
            return;
        }

        if (result.loser === currentPlayer.id) {
            this.gameSessionService.endCurrentTurn(gameSession);
            context.onTurnEnd(gameSession);
        } else {
            if (!this.gameSessionService.canPlayerTakeAction(gameSession)) {
                this.gameSessionService.endCurrentTurn(gameSession);
                context.onTurnEnd(gameSession);
            }
        }
    }

    @SubscribeMessage(CombatEvents.SubmitCombatPosture)
    handlePostureChosen(socket: Socket, payload: { posture: string }) {
        const gameSession = this.gameSessionService.getGameSession(socket.id);
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
            this.resolveCombatRound(gameSession);
        }
    }

    private resolveCombatRound(gameSession: GameSession): void {
        const combat = gameSession.getActiveCombat();    
        const attacker = gameSession.getCharacterById(combat.attackerId);
        const defender = gameSession.getCharacterById(combat.defenderId);

        const attackerAttackScore = this.calculateCombatScore(gameSession, attacker, combat, true, true);
        const attackerDefenseScore = this.calculateCombatScore(gameSession, attacker, combat, false, true);

        const defenderAttackScore = this.calculateCombatScore(gameSession, defender, combat, true, false);
        const defenderDefenseScore = this.calculateCombatScore(gameSession, defender, combat, false, false);

        const damageToDefender = Math.max(attackerAttackScore - defenderDefenseScore, 0);
        const damageToAttacker = Math.max(defenderAttackScore - attackerDefenseScore, 0);

        combat.attackerHp = Math.max(attacker.life - damageToAttacker, 0);
        combat.defenderHp = Math.max(defender.life - damageToDefender, 0);

        combat.roundNumber += 1;
    }

    private calculateCombatScore(gameSession: GameSession, character: Character, combat: ActiveCombat,
        isAttackMode: boolean, isAttacker: boolean): number {
            
        const posture = isAttacker ? combat.attackerPosture : combat.defenderPosture;
        const attackBonus = posture === COMBAT_POSTURE.OFFENSIVE ? 2 : 0;
        const defenseBonus = posture === COMBAT_POSTURE.DEFENSIVE ? 2 : 0;

        const baseStat = isAttackMode ? character.attack : character.defense;
        const postureBonus = isAttackMode ? attackBonus : defenseBonus;

        const tilePenalty = this.getTilePenalty(gameSession, character);

        const diceRoll = isAttackMode 
            ? this.rollDice(character.attackDice, isAttacker, gameSession.isDebugModeActivated)
            : this.rollDice(character.defenseDice, isAttacker, gameSession.isDebugModeActivated)

        return baseStat + postureBonus - tilePenalty + diceRoll;
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

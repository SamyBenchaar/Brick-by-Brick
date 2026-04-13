import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/gateways/game-session/game-play/game-play-handler.context';
import { CombatEndService } from '@app/services/game-session/combat/combat-end.service';
import { CombatRequestValidatorService } from '@app/services/game-session/combat/combat-request-validator.service';
import { CombatRoundService } from '@app/services/game-session/combat/combat-round.service';
import { CombatEndState, CombatRoundOutcome } from '@app/services/game-session/combat/combat-types';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { formatCombatRoundLog } from '@app/services/log/combat-log.util';
import { Character } from '@common/character';
import { ActiveCombat, CombatRoundResolvedPayload } from '@common/combat';
import { COMBAT_TURN_TIME } from '@common/constants/combat-constants';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class GamePlayCombatHandler {
    private readonly logger = new Logger(GamePlayCombatHandler.name);

    constructor(
        private readonly gameSessionService: GameSessionService,
        private readonly turnManagementService: TurnManagementService,
        private readonly combatRequestValidatorService: CombatRequestValidatorService,
        private readonly combatRoundService: CombatRoundService,
        private readonly combatEndService: CombatEndService,
    ) {}

    handleRequestCombat(
        socket: Socket,
        payload: { roomId: string; defenderId: string },
        context: GamePlayHandlerContext,
    ): void {
        const gameSession = this.gameSessionService.getGameSession(payload.roomId);
        if (!gameSession || this.combatRequestValidatorService.isCombatUnavailable(gameSession)) {
            return;
        }

        const participants = this.combatRequestValidatorService.getCombatParticipantsFromRequest(
            gameSession,
            socket.id,
            payload.defenderId,
        );
        if (!participants || !this.combatRequestValidatorService.canStartCombat(gameSession, participants)) {
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

        const roundDetails = this.combatRoundService.buildRoundDetails(gameSession, combat, attacker, defender);
        this.combatRoundService.applyRoundDamage(combat, roundDetails, attacker, defender);

        const payload = this.combatRoundService.buildRoundResolvedPayload(combat, roundDetails);
        const roundOutcome = this.combatRoundService.determineRoundWinner(
            roundDetails.damageToAttacker,
            roundDetails.damageToDefender,
        );
        this.logCombatRound({
            gameSession,
            attacker,
            defender,
            payload,
            roundOutcome,
            context,
        });

        const outcome = this.combatRoundService.getCombatOutcome(combat);
        if (outcome !== null) {
            if (context) {
                this.endCombat(gameSession, outcome, context);
            }
            return;
        }

        this.prepareNextCombatRound(gameSession, combat, payload, context);
    }

    private logCombatRound(args: {
        gameSession: GameSession;
        attacker: Character;
        defender: Character;
        payload: CombatRoundResolvedPayload;
        roundOutcome: CombatRoundOutcome;
        context?: GamePlayHandlerContext;
    }): void {
        const { gameSession, attacker, defender, payload, roundOutcome, context } = args;
        if (!context) {
            return;
        }

        const logMessage = formatCombatRoundLog(payload, attacker, defender, roundOutcome);
        const playersInvolved = [attacker.name, defender.name];

        context.logService.log(gameSession.roomId, logMessage, 'combat', playersInvolved);
    }

    private prepareNextCombatRound(
        gameSession: GameSession,
        combat: ActiveCombat,
        payload: CombatRoundResolvedPayload,
        context?: GamePlayHandlerContext,
    ): void {
        this.combatRoundService.prepareNextRound(combat);

        if (!context) {
            return;
        }

        context.server.to(gameSession.roomId).emit(CombatEvents.CombatRoundResolved, payload);
        gameSession.setCurrentCombatTurnTime(COMBAT_TURN_TIME);
        this.startCombatTurnTimer(gameSession, context);
    }

    private endCombat(
        gameSession: GameSession,
        outcome: CombatRoundOutcome,
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

        const combatState = this.combatEndService.buildCombatEndState(
            gameSession,
            attacker,
            defender,
            combat,
            outcome,
        );
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
}
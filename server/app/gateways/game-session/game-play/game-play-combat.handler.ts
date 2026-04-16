import { GameSession } from '@app/domain/game-session';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { CombatEndService } from '@app/services/game-session/combat/combat-end.service';
import { CombatRequestValidatorService } from '@app/services/game-session/combat/combat-request-validator.service';
import { CombatRoundService } from '@app/services/game-session/combat/combat-round.service';
import { CombatEndState, CombatRoundOutcome } from '@app/services/game-session/combat/combat-types';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { VirtualPlayerMechanicsService } from '@app/services/game-session/virtual-player-mechanics.service';
import { VirtualPlayerService } from '@app/services/game-session/virtual-player.service';
import { formatCombatRoundLog } from '@app/services/log/combat-log.util';
import { Character } from '@common/character';
import { ActiveCombat, COMBAT_POSTURE, CombatRoundResolvedPayload } from '@common/combat';
import { COMBAT_TURN_TIME } from '@common/constants/combat-constants';
import { GameModeValue } from '@common/constants/game-config-constants';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Socket } from 'socket.io';

const VIRTUAL_PLAYER_DELAY_MS = 2000;
const VIRTUAL_PLAYER_DELAY_RANGE_MS = 3000;

@Injectable()
export class GamePlayCombatHandler {
    private readonly logger = new Logger(GamePlayCombatHandler.name);

    @Optional()
    @Inject(forwardRef(() => VirtualPlayerMechanicsService))
    private readonly virtualPlayerMechanicsService?: VirtualPlayerMechanicsService;

    @Inject(VirtualPlayerService)
    private readonly virtualPlayerService: VirtualPlayerService;

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
        const combat = gameSession?.getActiveCombat();
        const player = gameSession?.players.find((p) => p.socketId === socket.id);
        if (!gameSession || !combat || !player) {
            return;
        }
        this.processCombatPosture(gameSession, combat, player.character.id, payload.posture, context);
    }
    initiateVirtualPlayerCombat(
        gameSession: GameSession,
        attacker: Character,
        defenderId: string,
        context: GamePlayHandlerContext,
    ): void {
        const defender = gameSession.players.find((p) => p.character.id === defenderId)?.character;
        const outOfActions = (attacker.remainingActions ?? 0) <= 0;
        const tooFar = defender && (Math.abs(attacker.position.x - defender.position.x) + Math.abs(attacker.position.y - defender.position.y)) !== 1;
        if (!defender || gameSession.isTurnStarting || gameSession.getActiveCombat() || outOfActions || tooFar) {
            return;
        }
        try {
            this.initiateActiveCombat(gameSession, defenderId, attacker, context);
            context.logService.log(gameSession.roomId, `Début de combat: ${attacker.name} attaque ${defender.name}`);
        } catch (error) {
            this.logger.error(`Combat error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        this.autoSelectVirtualPlayerPostures(gameSession, activeCombat, context);
    }
    private processCombatPosture(
        gameSession: GameSession,
        combat: ActiveCombat,
        playerId: string,
        posture: string,
        context: GamePlayHandlerContext,
    ): void {
        this.applyChosenPosture(combat, playerId, posture);
        if (combat.attackerPosture && combat.defenderPosture) {
            this.turnManagementService.stopCombatTimer(gameSession.roomId);
            this.resolveCombatRound(gameSession, context);
        }
    }

    private async autoSelectVirtualPlayerPostures(
        gameSession: GameSession,
        combat: ActiveCombat,
        context: GamePlayHandlerContext,
    ): Promise<void> {
        const attackerPlayer = gameSession.players.find(player => player.character.id === combat.attackerId);
        const defenderPlayer = gameSession.players.find(player => player.character.id === combat.defenderId);

        const choosePostureAsync = async (playerId: string, profile: string) => {
            let posture = profile === 'aggressive' ? COMBAT_POSTURE.OFFENSIVE : COMBAT_POSTURE.DEFENSIVE;

            if (this.virtualPlayerMechanicsService) {
                posture = await this.virtualPlayerMechanicsService.selectCombatPosture(profile);
            } else {
                const delay = Math.floor(Math.random() * VIRTUAL_PLAYER_DELAY_RANGE_MS) + VIRTUAL_PLAYER_DELAY_MS;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }

            const session = this.gameSessionService.getGameSession(gameSession.roomId);
            const currentCombat = session?.getActiveCombat();

            if (session && currentCombat && currentCombat.roundNumber === combat.roundNumber) {
                this.processCombatPosture(session, currentCombat, playerId, posture, context);
            }
        };

        if (attackerPlayer?.virtualProfile && !combat.attackerPosture) {
            choosePostureAsync(attackerPlayer.character.id, attackerPlayer.virtualProfile).catch(err =>
                this.logger.error(`Erreur bot attacker posture: ${err}`),
            );
        }
        if (defenderPlayer?.virtualProfile && !combat.defenderPosture) {
            choosePostureAsync(defenderPlayer.character.id, defenderPlayer.virtualProfile).catch(err =>
                this.logger.error(`Erreur bot defender posture: ${err}`),
            );
        }
    }

    private applyChosenPosture(combat: ActiveCombat, playerId: string, posture: string): void {
        if (playerId === combat.attackerId) combat.attackerPosture = posture;
        else if (playerId === combat.defenderId) combat.defenderPosture = posture;
    }
    private resolveCombatRound(gameSession: GameSession, context?: GamePlayHandlerContext): void {
        const combat = gameSession.getActiveCombat();
        const attacker = combat ? gameSession.getCharacterById(combat.attackerId) : null;
        const defender = combat ? gameSession.getCharacterById(combat.defenderId) : null;
        if (!combat || !attacker || !defender) {
            return;
        }

        const roundDetails = this.combatRoundService.buildRoundDetails(gameSession, combat, attacker, defender);
        this.combatRoundService.applyRoundDamage(combat, roundDetails, attacker, defender);
        const payload = this.combatRoundService.buildRoundResolvedPayload(combat, roundDetails);
        const roundOutcome = this.combatRoundService.determineRoundWinner(roundDetails.damageToAttacker, roundDetails.damageToDefender);

        if (context) {
            const logMessage = formatCombatRoundLog(payload, attacker, defender, roundOutcome);
            context.logService.log(gameSession.roomId, logMessage, 'combat', [attacker.name, defender.name]);
        }

        const outcome = this.combatRoundService.getCombatOutcome(combat);
        if (outcome !== null) {
            if (context) {
                this.endCombat(gameSession, outcome, context);
            }
            return;
        }
        this.prepareNextCombatRound(gameSession, combat, payload, context);
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
        this.autoSelectVirtualPlayerPostures(gameSession, combat, context);
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

        if (combatState.outcome === 'draw') {
            context.logService.log(
                gameSession.roomId,
                `Fin du combat: ${combatState.attacker.name} et ${combatState.defender.name} sont tous deux vaincus`,
            );
        } else if (combatState.winner) {
            const loser = combatState.winner.id === combatState.attacker.id ? combatState.defender : combatState.attacker;
            context.logService.log(
                gameSession.roomId,
                `Fin du combat: ${combatState.winner.name} a gagné contre ${loser.name}`,
            );
        }

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
            flagPosition: gameSession.gameMode === GameModeValue.Ctf ? gameSession.getFlagPosition() : null,
            flagHolderId: gameSession.gameMode === GameModeValue.Ctf ? gameSession.getFlagHolder() : null,
        });
        if (gameSession.gameMode === GameModeValue.Ctf) {
            context.server.to(gameSession.roomId).emit(GameSessionEvents.GameSessionUpdated, gameSession);
        }
        context.emitReachableTiles(gameSession);
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

        const fullCurrentPlayer = gameSession.players.find((player) => player.character.id === currentPlayer.id);
        if (fullCurrentPlayer?.virtualProfile) {
            this.virtualPlayerService.playTurn(gameSession, fullCurrentPlayer)
                .catch((error: Error) => {
                    this.logger.error(`Erreur durant la reprise du tour JV post-combat: ${error.message}`);
                })
                .finally(() => {
                    if (!gameSession.getActiveCombat()) {
                        this.gameSessionService.endCurrentTurn(gameSession);
                        context.onTurnEnd(gameSession);
                    }
                });
        }
    }
    private startCombatTurnTimer(gameSession: GameSession, context: GamePlayHandlerContext): void {
        context.server.to(gameSession.roomId).emit(CombatEvents.CombatTurnStarted, {
            timeRemaining: gameSession.getCurrentCombatTurnTime(),
        });
        this.turnManagementService.startCombatTimer(
            gameSession,
            () => {
                if (gameSession.getActiveCombat()) this.resolveCombatRound(gameSession, context);
            },
            (timeRemaining: number) => {
                context.server.to(gameSession.roomId).emit(CombatEvents.CombatTurnTimeUpdate, { timeRemaining });
            },
        );
    }
}

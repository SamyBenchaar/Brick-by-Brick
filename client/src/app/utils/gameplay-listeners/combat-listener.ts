import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import type { GameSessionSocketService } from '@app/services/communication/game-session-socket/game-session-socket.service';
import { SocketService } from '@app/services/communication/socket/socket.service';
import { CombatRoundResolvedPayload } from '@common/combat';
import { CombatEvents } from '@common/game.events';
import { Position } from '@common/position';

export function setupCombatListeners(
    socketService: SocketService,
    service: GamePlaySocketService,
    gameSessionSocketService: GameSessionSocketService,
    combatSocketService: CombatSocketService,
): void {
    socketService.on<{
        attackerId: string;
        defenderId: string;
        initiatorId: string;
        roundNumber: number;
        attackerPosture?: string;
        defenderPosture?: string;
        attackerHp: number;
        defenderHp: number;
    }>(CombatEvents.CombatStarted, (data) => {
        service.reachableTiles.set([]);
        combatSocketService.activeCombat.set(data);
        combatSocketService.latestRound.set(null);
    });

    socketService.on<{ timeRemaining: number }>(CombatEvents.CombatTurnStarted, (payload) => {
        combatSocketService.combatTurnTimeRemaining.set(payload.timeRemaining);
    });

    socketService.on<{ timeRemaining: number }>(CombatEvents.CombatTurnTimeUpdate, (payload) => {
        combatSocketService.combatTurnTimeRemaining.set(payload.timeRemaining);
    });

    socketService.on<CombatRoundResolvedPayload>(CombatEvents.CombatRoundResolved, (data) => {
        combatSocketService.latestRound.set(data);
        combatSocketService.activeCombat.update(current => current ? {
            ...current,
            attackerHp: data.attackerLife,
            defenderHp: data.defenderLife,
            roundNumber: data.roundNumber,
            attackerPosture: undefined,
            defenderPosture: undefined,
        } : null);
    });


    socketService.on<{
        winner: string;
        loser: string;
        attackerVictories: number;
        defenderNewPosition: Position;
        remainingActions: number;
    }>(CombatEvents.CombatResult, (data) => {
        service.reachableTiles.set([]);
        combatSocketService.activeCombat.set(null);
        combatSocketService.latestRound.set(null);
        combatSocketService.combatTurnTimeRemaining.set(null);
        const session = service.currentSession();
        if (session) {
            const attacker = session.players.find(p => p.character.id === data.winner);
            const defender = session.players.find(p => p.character.id === data.loser);
            if (attacker) {
                attacker.character.victories = data.attackerVictories;
                attacker.character.remainingActions = data.remainingActions;
            }
            if (defender) {
                defender.character.position = data.defenderNewPosition;
            }
            gameSessionSocketService.currentSession.set({ ...session });
        }
    });
    socketService.on(CombatEvents.CombatEnded, () => {
        service.reachableTiles.set([]);
        combatSocketService.activeCombat.set(null);
        combatSocketService.latestRound.set(null);
        combatSocketService.combatTurnTimeRemaining.set(null);
    });
}

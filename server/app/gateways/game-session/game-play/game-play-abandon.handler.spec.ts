import { GameSession } from '@app/domain/game-session';
import { GamePlayAbandonHandler } from '@app/gateways/game-session/game-play/game-play-abandon.handler';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { GamePlayHandlerContext } from '@app/interfaces/game-play-handler';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { LogService } from '@app/services/log/log.service';
import { CombatEvents, GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
import { SessionStatus } from '@common/session.status';
import { Server, Socket } from 'socket.io';

/**
 * Strategie de test:
 * - Couvre l'abandon en partie avec nettoyage combat, diffusion d'evenements et retrait du joueur.
 * - Verifie l'integration avec la verification de fin de partie apres abandon (ex: 3e victoire).
 * Cas limites couverts:
 * - Abandon pendant un combat actif: fin immediate du combat pour playerLeft.
 * - Abandon declenchant immediatement un vainqueur global.
 */
describe('GamePlayAbandonHandler', () => {
    const roomId = 'ROOM1';

    let handler: GamePlayAbandonHandler;
    let mockGameSessionService: Record<string, jest.Mock>;
    let mockStartingPointService: Record<string, jest.Mock>;
    let mockLogService: Record<string, jest.Mock>;
    let mockGameSessionGateway: Record<string, jest.Mock>;

    let roomEmitSpy: jest.Mock;
    let serverToSpy: jest.Mock;
    let context: GamePlayHandlerContext;

    let attacker: Player;
    let defender: Player;

    function buildSession(): GameSession {
        const players: Player[] = [attacker, defender];

        return {
            roomId,
            status: SessionStatus.Playing,
            players,
            gameMode: 'classic',
            mapCopy: { tiles: [] },
            flagPosition: null,
            flagHolderId: null,
            playerOrder: ['attacker', 'defender'],
            getCurrentPlayer: jest.fn(() => attacker.character),
            getActiveCombat: jest.fn(() => ({
                attackerId: 'attacker',
                defenderId: 'defender',
                initiatorId: 'attacker',
                roundNumber: 1,
                attackerHp: 6,
                defenderHp: 6,
            })),
            getCharacterById: jest.fn((id: string) => players.find((p) => p.character.id === id)?.character ?? null),
            isPlayerInActiveCombat: jest.fn((playerId: string) => playerId === 'attacker' || playerId === 'defender'),
            clearActiveCombat: jest.fn(),
            dropFlag: jest.fn(),
            getTotalPlayersInTeam: jest.fn(() => 1),
        } as unknown as GameSession;
    }

    beforeEach(() => {
        attacker = {
            socketId: 'socket-1',
            character: {
                id: 'attacker',
                name: 'Attacker',
                avatarId: 1,
                life: 6,
                maxLife: 6,
                speed: 4,
                attack: 4,
                defense: 4,
                actions: 1,
                movements: 3,
                attackDice: 'D4',
                defenseDice: 'D6',
                isActif: false,
                battlesWon: 0,
                remainingMovement: 3,
                remainingActions: 1,
                victories: 2,
                defeats: 0,
                totalDamageDealt: 0,
                totalDamageReceived: 0,
                tilesVisited: 0,
                hasFlag: false,
                position: { x: 1, y: 1 },
            },
        } as unknown as Player;

        defender = {
            socketId: 'socket-2',
            character: {
                id: 'defender',
                name: 'Defender',
                avatarId: 2,
                life: 6,
                maxLife: 6,
                speed: 4,
                attack: 4,
                defense: 4,
                actions: 1,
                movements: 3,
                attackDice: 'D4',
                defenseDice: 'D6',
                isActif: false,
                battlesWon: 0,
                remainingMovement: 3,
                remainingActions: 1,
                victories: 0,
                defeats: 0,
                totalDamageDealt: 0,
                totalDamageReceived: 0,
                tilesVisited: 0,
                hasFlag: false,
                position: { x: 2, y: 1 },
            },
        } as unknown as Player;

        mockGameSessionService = {
            getGameSession: jest.fn(),
            removePlayer: jest.fn(),
            checkGameWinner: jest.fn(),
            endCurrentTurn: jest.fn(),
        };

        mockLogService = {
            log: jest.fn(),
        };

        mockStartingPointService = {
            getClosestAvailableTileForFlag: jest.fn(() => ({ x: 0, y: 0 })),
        };

        mockGameSessionGateway = {
            clearSocketRoomTracking: jest.fn(),
        };

        roomEmitSpy = jest.fn();
        serverToSpy = jest.fn(() => ({ emit: roomEmitSpy }));

        context = {
            server: { to: serverToSpy } as unknown as Server,
            logService: mockLogService as unknown as LogService,
            onGameEnd: jest.fn(),
            onGameEndCanceled: jest.fn(),
            onTurnEnd: jest.fn(),
            emitReachableTiles: jest.fn(),
            resumeTurn: jest.fn(),
        } as unknown as GamePlayHandlerContext;

        handler = new GamePlayAbandonHandler(
            mockGameSessionService as unknown as GameSessionService,
            mockStartingPointService as unknown as StartingPointService,
            mockLogService as unknown as LogService,
            mockGameSessionGateway as unknown as GameSessionGateway,
        );
    });

    it('devrait terminer automatiquement le combat si un joueur abandonne pendant le combat', () => {
        const session = buildSession();
        mockGameSessionService.getGameSession.mockReturnValue(session);
        mockGameSessionService.checkGameWinner.mockReturnValue(null);
        mockGameSessionService.removePlayer.mockImplementation((_roomId: string, socketId: string) => {
            session.players = session.players.filter((p) => p.socketId !== socketId);
            session.playerOrder = session.playerOrder.filter((id) => id !== 'attacker');
        });

        const socket = {
            id: 'socket-1',
            leave: jest.fn(),
        } as unknown as Socket;

        handler.handlePlayerAbandoned(socket, { roomId }, context);

        expect(session.clearActiveCombat).toHaveBeenCalled();
        expect(roomEmitSpy).toHaveBeenCalledWith(
            CombatEvents.CombatEnded,
            expect.objectContaining({
                reason: 'playerLeft',
                abandonedPlayerId: 'attacker',
                survivorId: 'defender',
                survivorVictories: 1,
                survivorLife: defender.character.life,
            }),
        );
        expect(roomEmitSpy).toHaveBeenCalledWith(
            GameSessionEvents.PlayerAbandoned,
            expect.objectContaining({ playerId: 'attacker' }),
        );
        expect(mockGameSessionService.removePlayer).toHaveBeenCalledWith(roomId, 'socket-1');
        expect(mockGameSessionGateway.clearSocketRoomTracking).toHaveBeenCalledWith('socket-1');
    });

    it('devrait pouvoir finir la partie apres abandon si checkGameWinner detecte une 3e victoire', () => {
        const session = buildSession();
        mockGameSessionService.getGameSession.mockReturnValue(session);

        const winnerAfterAbandon = {
            ...defender.character,
            victories: 3,
        };

        mockGameSessionService.removePlayer.mockImplementation((_roomId: string, socketId: string) => {
            session.players = session.players.filter((p) => p.socketId !== socketId);
            session.playerOrder = session.playerOrder.filter((id) => id !== 'attacker');
        });
        mockGameSessionService.checkGameWinner.mockReturnValue(winnerAfterAbandon);

        const socket = {
            id: 'socket-1',
            leave: jest.fn(),
        } as unknown as Socket;

        handler.handlePlayerAbandoned(socket, { roomId }, context);

        expect(mockGameSessionService.checkGameWinner).toHaveBeenCalledWith(session);
        expect(context.onGameEnd).toHaveBeenCalledWith(session, winnerAfterAbandon);
    });
});

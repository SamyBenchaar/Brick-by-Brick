import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GamePlayGateway } from '@app/gateways/game-session/game-play/game-play-gateway/game-play.gateway';
import { GamePlayHandlersProvider } from '@app/gateways/game-session/game-play/game-play-handlers.provider';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { createMockSession, createTestSocket } from '@app/gateways/game-session/test-utils';
import { GameSessionService } from '@app/services/game-session/game-session/game-session.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { LogService } from '@app/services/log/log.service';
import { GameSessionEvents } from '@common/game.events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Stratégie de test (portée: démarrer une partie) pour GamePlayGateway:
 *
 * 1. Démarrage valide : hôte avec ≥2 joueurs déclenche GameStarted et init de session
 * 2. Démarrage refusé : demandeur non-hôte
 * 3. Démarrage refusé : moins de 2 joueurs
 * 4. Démarrage refusé : session introuvable
 */
describe('GamePlayGateway - handleStartGame', () => {
    let gateway: GamePlayGateway;
    let mockGameSessionService: Record<string, jest.Mock>;
    let mockChatGateway: Record<string, jest.Mock>;
    let mockGameSessionGateway: Record<string, jest.Mock>;
    let mockMovementService: Record<string, jest.Mock>;
    let mockTurnManagementService: Record<string, jest.Mock>;
    let mockServer: { emit: jest.Mock; to: jest.Mock };

    beforeEach(async () => {
        mockGameSessionService = {
            getGameSession: jest.fn(),
            getFullMapData: jest.fn(),
            initializeGameSession: jest.fn(),
            endCurrentTurn: jest.fn(),
            getAvailableGameSessions: jest.fn(),
            executeMove: jest.fn(),
            canPlayerTakeAction: jest.fn(),
            executeCombat: jest.fn(),
            checkGameWinner: jest.fn(),
            removePlayer: jest.fn(),
        };

        mockChatGateway = {} as Record<string, jest.Mock>;
        mockGameSessionGateway = {
            notifyGameSessionListUpdated: jest.fn(),
        } as Record<string, jest.Mock>;
        mockMovementService = {} as Record<string, jest.Mock>;
        mockTurnManagementService = {} as Record<string, jest.Mock>;

        const toReturn = { emit: jest.fn() };
        mockServer = {
            emit: jest.fn(),
            to: jest.fn().mockReturnValue(toReturn),
        };

        const mockGamePlayHandlersProvider = {
            combatHandler: {},
            movementHandler: {},
            ctfHandler: {},
            turnHandler: {},
        };

        const mockLogService = {
            addLog: {},
            getLogs: {},
            log: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GamePlayGateway,
                Logger,
                { provide: GameSessionService, useValue: mockGameSessionService },
                { provide: ChatGateway, useValue: mockChatGateway },
                { provide: GameSessionGateway, useValue: mockGameSessionGateway },
                { provide: MovementService, useValue: mockMovementService },
                { provide: TurnManagementService, useValue: mockTurnManagementService },
                { provide: GamePlayHandlersProvider, useValue: mockGamePlayHandlersProvider },
                { provide: LogService, useValue: mockLogService },
            ],
        }).compile();

        gateway = module.get<GamePlayGateway>(GamePlayGateway);
        (gateway as unknown as { server: typeof mockServer }).server = mockServer;
        // Éviter les timers internes pendant les tests
        (gateway as unknown as { startGameTurn: jest.Mock }).startGameTurn = jest.fn();
    });

    it("devrait démarrer la partie si l'hôte a 2+ joueurs", async () => {
        const socket = createTestSocket('host-1');
        const session = createMockSession('ROOM1', 'host-1', 2);
        const fullMapData = { tiles: [] };
        mockGameSessionService.getGameSession.mockReturnValue(session);
        mockGameSessionService.getFullMapData.mockResolvedValue(fullMapData);

        await gateway.handleStartGame(socket, { roomId: 'ROOM1' });

        expect(mockGameSessionService.initializeGameSession).toHaveBeenCalledWith(session, fullMapData);
        expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
        expect(mockServer.to('ROOM1').emit).toHaveBeenCalledWith(GameSessionEvents.GameStarted, {
            roomId: 'ROOM1',
            mapData: fullMapData,
            gameSession: session,
        });
        expect((gateway as unknown as { startGameTurn: jest.Mock }).startGameTurn).toHaveBeenCalledWith(session);
    });

    it("devrait refuser si le demandeur n'est pas l'hôte", async () => {
        const socket = createTestSocket('not-host');
        const session = createMockSession('ROOM1', 'host-1', 2);
        mockGameSessionService.getGameSession.mockReturnValue(session);

        await gateway.handleStartGame(socket, { roomId: 'ROOM1' });

        expect(socket.emit).toHaveBeenCalledWith(
            GameSessionEvents.GameSessionJoinError,
            "Seul l'organisateur peut démarrer la partie",
        );
        expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('devrait refuser s\'il y a moins de 2 joueurs', async () => {
        const socket = createTestSocket('host-1');
        const session = createMockSession('ROOM1', 'host-1', 1);
        mockGameSessionService.getGameSession.mockReturnValue(session);

        await gateway.handleStartGame(socket, { roomId: 'ROOM1' });

        expect(socket.emit).toHaveBeenCalledWith(
            GameSessionEvents.GameSessionJoinError,
            'Il faut au moins 2 joueurs pour démarrer',
        );
        expect(mockGameSessionService.initializeGameSession).not.toHaveBeenCalled();
    });

    it('devrait émettre une erreur si la session est introuvable', async () => {
        const socket = createTestSocket('host-1');
        mockGameSessionService.getGameSession.mockReturnValue(undefined);

        await gateway.handleStartGame(socket, { roomId: 'FAKE' });

        expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
    });
});

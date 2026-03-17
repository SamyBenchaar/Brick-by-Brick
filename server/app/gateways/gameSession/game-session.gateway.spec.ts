import { GameSession } from '@app/domain/game-session';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { GameSessionEvents } from '@common/game.events';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSessionGateway } from './game-session.gateway';
import { createMockSession, createTestCharacter, createTestSocket } from './test-utils';

/**
 * Stratégie de test (portée: joindre une partie) pour GameSessionGateway:
 *
 * 1. Liste des sessions : demande/envoi des sessions disponibles et présence du nombre de joueurs par partie
 * 2. Rejoindre une session : cas valide + cas limites (session introuvable, session pleine/verrouillée, non-hôte qui démarre, <2 joueurs)
 * 3. Liste dynamique : émission de GameSessionListUpdated quand la disponibilité change
 * 4. Observation de session : abonnement valide et gestion d'une session introuvable (cas limite)
 * 5. Disponibilités d'avatars : diffusion en temps réel et ignorance des mises à jour si la session est introuvable (cas limite)
 * 6. Quitter la salle d'attente/déconnexion : nettoyage de salle vide, suppression de session par l'hôte, suppression côté joueur non-hôte, déconnexion en partie (cas limite)
 */
describe('GameSessionGateway', () => {
    const MAX_PLAYERS = 4;
    const THREE_PLAYERS = 3;
    const AVATAR_ID_THREE = 3;

    let gateway: GameSessionGateway;
    let mockGameSessionService: Record<string, jest.Mock>;
    let mockChatGateway: Record<string, jest.Mock>;
    let mockServer: { emit: jest.Mock; to: jest.Mock; sockets: { sockets: Map<string, { leave: jest.Mock }> } };

    beforeEach(async () => {
        mockGameSessionService = {
            createGameSession: jest.fn(),
            joinSession: jest.fn(),
            getGameSession: jest.fn(),
            getAvailableGameSessions: jest.fn().mockReturnValue([]),
            deleteGameSession: jest.fn(),
            kickPlayer: jest.fn(),
            removePlayer: jest.fn(),
        };

        mockChatGateway = {
            clearChatHistoryForRoom: jest.fn(),
        };

        const toReturn = { emit: jest.fn() };
        mockServer = {
            emit: jest.fn(),
            to: jest.fn().mockReturnValue(toReturn),
            sockets: { sockets: new Map() },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameSessionGateway,
                Logger,
                { provide: GameSessionService, useValue: mockGameSessionService },
                { provide: ChatGateway, useValue: mockChatGateway },
            ],
        }).compile();

        gateway = module.get<GameSessionGateway>(GameSessionGateway);
        (gateway as unknown as { server: typeof mockServer }).server = mockServer;
    });

    describe('handleConnection', () => {
        it('devrait loguer la connexion du client', () => {
            const socket = createTestSocket('s1');
            const logger = (gateway as unknown as { logger: Logger }).logger;
            const logSpy = jest.spyOn(logger, 'log');

            gateway.handleConnection(socket);

            expect(logSpy).toHaveBeenCalledWith(`Client connecté au GameSessionGateway: ${socket.id}`);
        });
    });

    describe('handleRequestAvailableGameSessionList', () => {
        it('devrait envoyer la liste des sessions disponibles au socket', () => {
            const socket = createTestSocket('s1');
            const sessions = [createMockSession('R1', 'h1')];
            mockGameSessionService.getAvailableGameSessions.mockReturnValue(sessions);

            gateway.handleRequestAvailableGameSessionList(socket);

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionList, sessions);
        });

        it('devrait inclure le nombre de joueurs via la liste players de chaque partie', () => {
            const socket = createTestSocket('s1');
            const sessions = [createMockSession('R1', 'h1', THREE_PLAYERS)];
            mockGameSessionService.getAvailableGameSessions.mockReturnValue(sessions);

            gateway.handleRequestAvailableGameSessionList(socket);

            const gameSessionListCall = (socket.emit as jest.Mock).mock.calls.find(
                ([event]) => event === GameSessionEvents.GameSessionList,
            );
            const emittedSessions = gameSessionListCall?.[1] as GameSession[];

            expect(emittedSessions).toBeDefined();
            expect(emittedSessions[0].players.length).toBe(THREE_PLAYERS);
        });
    });

    describe('handleCreateGameSession', () => {
        it('devrait créer une session et joindre la salle socket', async () => {
            const socket = createTestSocket('host-1');
            const character = createTestCharacter('HostPlayer');
            const session = createMockSession('ROOM1', 'host-1');
            mockGameSessionService.createGameSession.mockResolvedValue(session);//mock return value pour async

            await gateway.handleCreateGameSession(socket, { gameId: 'game-1', hostPlayer: character });

            expect(socket.join).toHaveBeenCalledWith('ROOM1');
            expect(mockServer.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionCreated, session);
        });
    });

    describe('handleJoinGameSession', () => {
        it('devrait permettre à un joueur de rejoindre une session valide', () => {
            const socket = createTestSocket('p2');
            const session = createMockSession('ROOM1', 'h1', 2);
            mockGameSessionService.joinSession.mockReturnValue(null);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockGameSessionService.getAvailableGameSessions.mockReturnValue([]);

            gateway.handleJoinGameSession(socket, { roomId: 'ROOM1', player: createTestCharacter('P2') });

            expect(socket.join).toHaveBeenCalledWith('ROOM1');
            expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
            expect(mockServer.to('ROOM1').emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionUpdated, session);
        });

        it('devrait émettre GameSessionListUpdated après un join valide', () => {
            const socket = createTestSocket('p2');
            const session = createMockSession('ROOM1', 'h1', 2);
            const updatedSessions = [createMockSession('ROOM2', 'h2', 1)];
            mockGameSessionService.joinSession.mockReturnValue(null);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockGameSessionService.getAvailableGameSessions.mockReturnValue(updatedSessions);

            gateway.handleJoinGameSession(socket, { roomId: 'ROOM1', player: createTestCharacter('P2') });

            expect(mockServer.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionListUpdated, updatedSessions);
        });

        it('devrait mémoriser la salle du socket après un join valide', () => {
            const socket = createTestSocket('p2');
            const session = createMockSession('ROOM1', 'h1', 2);
            mockGameSessionService.joinSession.mockReturnValue(null);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockGameSessionService.getAvailableGameSessions.mockReturnValue([]);

            gateway.handleJoinGameSession(socket, { roomId: 'ROOM1', player: createTestCharacter('P2') });

            const socketToRoom = (gateway as unknown as { socketToRoom: Map<string, string> }).socketToRoom;
            expect(socketToRoom.get('p2')).toBe('ROOM1');
        });

        it('devrait émettre une erreur si la session est pleine ou a déjà commencé', () => {
            const socket = createTestSocket('p2');
            const session = createMockSession('ROOM1', 'h1', MAX_PLAYERS);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockGameSessionService.joinSession.mockReturnValue('La session de jeu est pleine');

            gateway.handleJoinGameSession(socket, { roomId: 'ROOM1', player: createTestCharacter('P2') });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'La session de jeu est pleine');
            expect(socket.join).not.toHaveBeenCalled();
        });

        it('devrait émettre une erreur si la session est introuvable', () => {
            const socket = createTestSocket('p2');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleJoinGameSession(socket, { roomId: 'FAKE', player: createTestCharacter('P2') });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
        });
    });

    describe('handleLeaveGameSession / handleDisconnect', () => {
        it('devrait annuler la salle si l\'hôte quitte', () => {
            const socket = createTestSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleLeaveGameSession(socket, { roomId: 'ROOM1' });

            expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
            expect(mockGameSessionService.deleteGameSession).toHaveBeenCalledWith('ROOM1');
            expect(mockChatGateway.clearChatHistoryForRoom).toHaveBeenCalledWith('ROOM1');
        });

        it('devrait retirer le joueur non-hôte et mettre à jour la session', () => {
            const socket = createTestSocket('player-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleLeaveGameSession(socket, { roomId: 'ROOM1' });

            expect(session.removePlayer).toHaveBeenCalledWith('player-1');
        });

        it('devrait gérer la déconnexion automatique si le socket est dans une salle', () => {
            const socket = createTestSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1');
            mockGameSessionService.getGameSession.mockReturnValue(session);

            // Simuler l'ajout du socket dans la map via handleCreateGameSession
            (gateway as unknown as { socketToRoom: Map<string, string> }).socketToRoom.set('host-1', 'ROOM1');

            gateway.handleDisconnect(socket);

            expect(mockGameSessionService.deleteGameSession).toHaveBeenCalledWith('ROOM1');
        });
    });

    describe('handleKickPlayer', () => {
        it('devrait exclure un joueur si l\'hôte le demande', () => {
            const socket = createTestSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockServer.sockets.sockets.set('player-1', { leave: jest.fn() });

            gateway.handleKickPlayer(socket, { roomId: 'ROOM1', targetId: 'player-1' });

            expect(mockGameSessionService.kickPlayer).toHaveBeenCalledWith('ROOM1', 'player-1');
            expect(mockServer.to).toHaveBeenCalledWith('player-1');
        });

        it('devrait refuser si le demandeur n\'est pas l\'hôte', () => {
            const socket = createTestSocket('not-host');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleKickPlayer(socket, { roomId: 'ROOM1', targetId: 'player-1' });

            expect(socket.emit).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionJoinError,
                "Seul l'organisateur peut exclure un joueur",
            );
        });

        it('devrait gérer session introuvable lors d\'un kick', () => {
            const socket = createTestSocket('host-1');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleKickPlayer(socket, { roomId: 'FAKE', targetId: 'p1' });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
        });
    });

    describe('handleObserveGameSession', () => {
        it('devrait permettre à un socket d\'observer une session valide', () => {
            const socket = createTestSocket('obs-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleObserveGameSession(socket, { roomId: 'ROOM1' });

            expect(socket.join).toHaveBeenCalledWith('ROOM1');
            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.AvatarTakenUpdated, session.getTakenAvatars());
        });

        it('devrait émettre une erreur si la session est introuvable', () => {
            const socket = createTestSocket('obs-1');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleObserveGameSession(socket, { roomId: 'FAKE' });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
        });
    });

    describe('handleAvatarTakenUpdated', () => {
        it('devrait mettre à jour l\'avatar pris et notifier la salle', () => {
            const socket = createTestSocket('p1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleAvatarTakenUpdated(socket, { roomId: 'ROOM1', newAvatarId: AVATAR_ID_THREE });

            expect(session.socketToAvatar.get('p1')).toBe(AVATAR_ID_THREE);
            expect(session.getTakenAvatars).toHaveBeenCalled();
            expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
        });

        it('devrait ne rien faire si la session est introuvable', () => {
            const socket = createTestSocket('p1');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleAvatarTakenUpdated(socket, { roomId: 'FAKE', newAvatarId: AVATAR_ID_THREE });

            expect(mockServer.to).not.toHaveBeenCalled();
        });
    });

    describe('handleDisconnect en partie', () => {
        it('devrait gérer la déconnexion pendant une partie en cours', () => {
            const socket = createTestSocket('player-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            session.status = 'playing';
            mockGameSessionService.getGameSession.mockReturnValue(session);
            (gateway as unknown as { socketToRoom: Map<string, string> }).socketToRoom.set('player-1', 'ROOM1');

            gateway.handleDisconnect(socket);

            expect(mockGameSessionService.removePlayer).toHaveBeenCalledWith('ROOM1', 'player-1');
            expect(socket.leave).toHaveBeenCalledWith('ROOM1');
        });
    });

    describe('handlePlayerLeave nettoyage salle vide', () => {
        it('devrait nettoyer la salle si le dernier joueur non-hôte quitte et la salle est vide', () => {
            const socket = createTestSocket('player-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            session.isHost = jest.fn().mockReturnValue(false);
            session.removePlayer = jest.fn(() => {
                session.players = [];
            });
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleLeaveGameSession(socket, { roomId: 'ROOM1' });

            expect(mockGameSessionService.deleteGameSession).toHaveBeenCalledWith('ROOM1');
            expect(mockChatGateway.clearChatHistoryForRoom).toHaveBeenCalledWith('ROOM1');
        });
    });
});
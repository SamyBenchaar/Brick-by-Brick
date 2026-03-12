import { GameSession } from '@app/domain/game-session';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionService } from '@app/services/gameSession/gameSession.service';
import { Character } from '@common/character';
import { GameSessionEvents } from '@common/game.events';
import { Player } from '@common/player';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { GameSessionGateway } from './game-session.gateway';
import { Dice } from '@common/dice';

/**
 * Stratégie de test pour GameSessionGateway:
 *
 * 1. Gestion des connexions : Connexion, déconnexion, nettoyage des salles
 * 2. Liste des sessions : Demande et envoi de la liste des sessions disponibles
 * 3. Création de session : Création de salle avec joueur hôte
 * 4. Rejoindre une session : Cas valides et erreurs (verrouillée, pleine)
 * 5. Quitter/Déconnexion : Hôte quitte = salle annulée, joueur quitte = mise à jour
 * 6. Démarrer la partie : Validation (hôte, min 2 joueurs)
 * 7. Exclure un joueur : Seul l'hôte peut exclure
 */
describe('GameSessionGateway', () => {
    let gateway: GameSessionGateway;
    let mockGameSessionService: Record<string, jest.Mock>;
    let mockChatGateway: Record<string, jest.Mock>;
    let mockServer: { emit: jest.Mock; to: jest.Mock; sockets: { sockets: Map<string, { leave: jest.Mock }> } };

    const createCharacter = (name = 'TestPlayer'): Character => ({
        id: '',
        name,
        avatarId: 1,
        maxLife: 6,
        life: 6,
        speed: 6,
        attack: 4,
        defense: 4,
        movements: 6,
        actions: 1,
        attackDice: Dice.D4,
        defenseDice: Dice.D6,
        isActif: false,
        battlesWon: 0,
    });

    const createSocket = (id: string): Socket => {
        const socket = {
            id,
            emit: jest.fn(),//fausse fonction espionnable pour vérifier les émissions
            join: jest.fn(),
            leave: jest.fn(),
        } as unknown as Socket;
        return socket;
    };

    const createMockSession = (roomId: string, hostId: string, playerCount = 1): GameSession => {
        const session = {
            roomId,
            status: 'waiting' as const,
            maxPlayers: 4,
            players: [] as Player[],
            host: { socketId: hostId, character: createCharacter('Host') },
            mapCopy: null,
            isHost: jest.fn((id: string) => id === hostId),
            isFull: jest.fn(() => session.players.length >= session.maxPlayers),
            addPlayer: jest.fn(),
            removePlayer: jest.fn((id: string) => {
                session.players = session.players.filter((p: Player) => p.socketId !== id);
            }),
            startGame: jest.fn(() => { session.status = 'playing'; }),
        } as unknown as GameSession;

        for (let i = 0; i < playerCount; i++) {
            session.players.push({ socketId: i === 0 ? hostId : `player-${i}`, character: createCharacter(`P${i}`) });
        }

        return session;
    };

    beforeEach(async () => {
        mockGameSessionService = {
            createGameSession: jest.fn(),
            joinSession: jest.fn(),
            getGameSession: jest.fn(),
            getAvailableGameSessions: jest.fn().mockReturnValue([]),
            deleteGameSession: jest.fn(),
            kickPlayer: jest.fn(),
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

    describe('handleRequestAvailableGameSessionList', () => {
        it('devrait envoyer la liste des sessions disponibles au socket', () => {
            const socket = createSocket('s1');
            const sessions = [createMockSession('R1', 'h1')];
            mockGameSessionService.getAvailableGameSessions.mockReturnValue(sessions);

            gateway.handleRequestAvailableGameSessionList(socket);

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionList, sessions);
        });
    });

    describe('handleCreateGameSession', () => {
        it('devrait créer une session et joindre la salle socket', async () => {
            const socket = createSocket('host-1');
            const character = createCharacter('HostPlayer');
            const session = createMockSession('ROOM1', 'host-1');
            mockGameSessionService.createGameSession.mockResolvedValue(session);//mock return value pour async

            await gateway.handleCreateGameSession(socket, { gameId: 'game-1', hostPlayer: character });

            expect(socket.join).toHaveBeenCalledWith('ROOM1');
            expect(mockServer.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionCreated, session);
        });
    });

    describe('handleJoinGameSession', () => {
        it('devrait permettre à un joueur de rejoindre une session valide', () => {
            const socket = createSocket('p2');
            const session = createMockSession('ROOM1', 'h1', 2);
            mockGameSessionService.joinSession.mockReturnValue(null);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockGameSessionService.getAvailableGameSessions.mockReturnValue([]);

            gateway.handleJoinGameSession(socket, { roomId: 'ROOM1', player: createCharacter('P2') });

            expect(socket.join).toHaveBeenCalledWith('ROOM1');
            expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
        });

        it('devrait émettre une erreur si la session est verrouillée ou pleine', () => {
            const socket = createSocket('p2');
            const session = createMockSession('ROOM1', 'h1', 4);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockGameSessionService.joinSession.mockReturnValue('La session de jeu est pleine');

            gateway.handleJoinGameSession(socket, { roomId: 'ROOM1', player: createCharacter('P2') });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'La session de jeu est pleine');
            expect(socket.join).not.toHaveBeenCalled();
        });

        it('devrait émettre une erreur si la session est introuvable', () => {
            const socket = createSocket('p2');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleJoinGameSession(socket, { roomId: 'FAKE', player: createCharacter('P2') });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
        });
    });

    describe('handleStartGame', () => {
        it('devrait démarrer la partie si l\'hôte a 2+ joueurs', () => {
            const socket = createSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleStartGame(socket, { roomId: 'ROOM1' });

            expect(session.startGame).toHaveBeenCalled();
            expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
        });

        it('devrait refuser si le demandeur n\'est pas l\'hôte', () => {
            const socket = createSocket('not-host');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleStartGame(socket, { roomId: 'ROOM1' });

            expect(socket.emit).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionJoinError,
                "Seul l'organisateur peut démarrer la partie",
            );
        });

        it('devrait refuser s\'il y a moins de 2 joueurs', () => {
            const socket = createSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1', 1);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleStartGame(socket, { roomId: 'ROOM1' });

            expect(socket.emit).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionJoinError,
                'Il faut au moins 2 joueurs pour démarrer',
            );
        });

        it('devrait émettre une erreur si la session est introuvable', () => {
            const socket = createSocket('host-1');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleStartGame(socket, { roomId: 'FAKE' });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
        });
    });

    describe('handleLeaveGameSession / handleDisconnect', () => {
        it('devrait annuler la salle si l\'hôte quitte', () => {
            const socket = createSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleLeaveGameSession(socket, { roomId: 'ROOM1' });

            expect(mockServer.to).toHaveBeenCalledWith('ROOM1');
            expect(mockGameSessionService.deleteGameSession).toHaveBeenCalledWith('ROOM1');
            expect(mockChatGateway.clearChatHistoryForRoom).toHaveBeenCalledWith('ROOM1');
        });

        it('devrait retirer le joueur non-hôte et mettre à jour la session', () => {
            const socket = createSocket('player-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleLeaveGameSession(socket, { roomId: 'ROOM1' });

            expect(session.removePlayer).toHaveBeenCalledWith('player-1');
        });

        it('devrait gérer la déconnexion automatique si le socket est dans une salle', () => {
            const socket = createSocket('host-1');
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
            const socket = createSocket('host-1');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);
            mockServer.sockets.sockets.set('player-1', { leave: jest.fn() });

            gateway.handleKickPlayer(socket, { roomId: 'ROOM1', targetId: 'player-1' });

            expect(mockGameSessionService.kickPlayer).toHaveBeenCalledWith('ROOM1', 'player-1');
            expect(mockServer.to).toHaveBeenCalledWith('player-1');
        });

        it('devrait refuser si le demandeur n\'est pas l\'hôte', () => {
            const socket = createSocket('not-host');
            const session = createMockSession('ROOM1', 'host-1', 2);
            mockGameSessionService.getGameSession.mockReturnValue(session);

            gateway.handleKickPlayer(socket, { roomId: 'ROOM1', targetId: 'player-1' });

            expect(socket.emit).toHaveBeenCalledWith(
                GameSessionEvents.GameSessionJoinError,
                "Seul l'organisateur peut exclure un joueur",
            );
        });

        it('devrait gérer session introuvable lors d\'un kick', () => {
            const socket = createSocket('host-1');
            mockGameSessionService.getGameSession.mockReturnValue(undefined);

            gateway.handleKickPlayer(socket, { roomId: 'FAKE', targetId: 'p1' });

            expect(socket.emit).toHaveBeenCalledWith(GameSessionEvents.GameSessionJoinError, 'Session introuvable');
        });
    });
});

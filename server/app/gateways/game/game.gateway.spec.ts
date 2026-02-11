import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { GameGateway } from './game.gateway';
import { GameService } from '@app/services/game/game.service';
import { GameEvents } from '@common/game.events';
import { Game } from '@app/model/game';

describe('GameGateway', () => {
    let gateway: GameGateway;

    let loggerMock: jest.Mocked<Logger>;
    let gameServiceMock: jest.Mocked<GameService>;
    let socketMock: jest.Mocked<Socket>;
    let serverMock: jest.Mocked<Server>;

    beforeEach(async () => {
        loggerMock = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        } as unknown as jest.Mocked<Logger>;

        gameServiceMock = {
            findAdminMenuGames: jest.fn(),
            findVisible: jest.fn(),
        } as unknown as jest.Mocked<GameService>;

        socketMock = {
            id: 'socket123',
            emit: jest.fn(),
        } as unknown as jest.Mocked<Socket>;

        serverMock = {
            emit: jest.fn(),
        } as unknown as jest.Mocked<Server>;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameGateway,
                { provide: Logger, useValue: loggerMock },
                { provide: GameService, useValue: gameServiceMock },
            ],
        }).compile();

        gateway = module.get<GameGateway>(GameGateway);

        (gateway as unknown as { server: Server }).server = serverMock;
    });

    it('afterInit should log initialization', () => {
        gateway.afterInit();
        expect(loggerMock.log).toHaveBeenCalledWith('GameGateway initialisé');
    });

    it('handleConnection should log connection', () => {
        gateway.handleConnection(socketMock);
        expect(loggerMock.log).toHaveBeenCalledWith(
            `Client connecté au GameGateway: ${socketMock.id}`,
        );
    });

    it('handleDisconnect should log disconnection', () => {
        gateway.handleDisconnect(socketMock);
        expect(loggerMock.log).toHaveBeenCalledWith(
            `Client déconnecté du GameGateway: ${socketMock.id}`,
        );
    });

    it('handleRequestGameList should emit game list', async () => {
        const games: Game[] = [{ id: '1' } as unknown as Game];
        gameServiceMock.findAdminMenuGames.mockResolvedValue(games);

        await gateway.handleRequestGameList(socketMock);

        expect(gameServiceMock.findAdminMenuGames).toHaveBeenCalled();
        expect(socketMock.emit).toHaveBeenCalledWith(GameEvents.GameList, games);
    });

    it('handleRequestVisibleGameList should emit visible games', async () => {
        const games: Game[] = [{ id: '2' } as unknown as Game];
        gameServiceMock.findVisible.mockResolvedValue(games);

        await gateway.handleRequestVisibleGameList(socketMock);

        expect(gameServiceMock.findVisible).toHaveBeenCalled();
        expect(socketMock.emit).toHaveBeenCalledWith(GameEvents.GameList, games);
    });

    it('notifyGameCreated should broadcast', () => {
        const game = { id: '1' } as unknown as Game;

        gateway.notifyGameCreated(game);

        expect(serverMock.emit).toHaveBeenCalledWith(GameEvents.GameCreated, game);
    });

    it('notifyGameUpdated should broadcast', () => {
        const game = { id: '1' } as unknown as Game;

        gateway.notifyGameUpdated(game);

        expect(serverMock.emit).toHaveBeenCalledWith(GameEvents.GameUpdated, game);
    });

    it('notifyGameDeleted should broadcast', () => {
        const gameId = '1';

        gateway.notifyGameDeleted(gameId);

        expect(serverMock.emit).toHaveBeenCalledWith(GameEvents.GameDeleted, gameId);
    });
});

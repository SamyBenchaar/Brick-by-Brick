import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from '@app/services/game/game.service';

describe('GameGateway', () => {
    let gateway: GameGateway;

    const mockGameService = {
        findAdminMenuGames: jest.fn().mockResolvedValue([]),
        findVisible: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameGateway,
                {
                    provide: GameService,
                    useValue: mockGameService,
                },
                {
                    provide: Logger,
                    useValue: mockLogger,
                },
            ],
        }).compile();

        gateway = module.get<GameGateway>(GameGateway);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    it('should have handleRequestGameList method', () => {
        expect(gateway.handleRequestGameList).toBeDefined();
    });
});

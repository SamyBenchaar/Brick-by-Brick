import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from './game.gateway';
import { GameService } from '@app/services/game/game.service';
import { Logger } from '@nestjs/common';

describe('GameGateway', () => {
    let gateway: GameGateway;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameGateway,
                {
                    provide: Logger,
                    useValue: {
                        log: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                    },
                },
                {
                    provide: GameService,
                    useValue: {
                        findAdminMenuGames: jest.fn().mockResolvedValue([]),
                        findVisible: jest.fn().mockResolvedValue([]),
                    },
                },
            ],
        }).compile();

        gateway = module.get<GameGateway>(GameGateway);
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });
});


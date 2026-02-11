import { GameGateway } from '@app/gateways/game/game.gateway';
import { Game } from '@app/model/game';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';

describe('GameService', () => {
    let service: GameService;

    const mockGameModel = {
        find: jest.fn().mockReturnThis(),
        findById: jest.fn().mockReturnThis(),
        findByIdAndUpdate: jest.fn().mockReturnThis(),
        findByIdAndDelete: jest.fn().mockReturnThis(),
        create: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
    };

    const mockMapValidationService = {
        validateMap: jest.fn().mockResolvedValue([]),
    };

    const mockGameMetadataValidationService = {
        validateMetadata: jest.fn().mockResolvedValue([]),
    };

    const mockGameGateway = {
        notifyGameCreated: jest.fn(),
        notifyGameUpdated: jest.fn(),
        notifyGameDeleted: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameService,
                {
                    provide: getModelToken(Game.name),
                    useValue: mockGameModel,
                },
                {
                    provide: MapValidationService,
                    useValue: mockMapValidationService,
                },
                {
                    provide: GameMetadataValidationService,
                    useValue: mockGameMetadataValidationService,
                },
                {
                    provide: GameGateway,
                    useValue: mockGameGateway,
                },
            ],
        }).compile();

        service = module.get<GameService>(GameService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('should have findAdminMenuGames method', () => {
        expect(service.findAdminMenuGames).toBeDefined();
    });
});

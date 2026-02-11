import { GameGateway } from '@app/gateways/game/game.gateway';
import { Game } from '@app/model/game';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from './game.service';

describe('GameService', () => {
    let service: GameService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameService,
                {
                    provide: getModelToken(Game.name),
                    useValue: {
                        find: jest.fn(),
                        findById: jest.fn(),
                        findByIdAndUpdate: jest.fn(),
                        findByIdAndDelete: jest.fn(),
                    },
                },
                {
                    provide: MapValidationService,
                    useValue: {
                        validateMap: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: GameMetadataValidationService,
                    useValue: {
                        validateMetadata: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: GameGateway,
                    useValue: {
                        notifyGameCreated: jest.fn(),
                        notifyGameUpdated: jest.fn(),
                        notifyGameDeleted: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<GameService>(GameService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});


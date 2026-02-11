import { CreateGameSessionDto } from '@app/dto/create-game-session.dto';
import { GameSession } from '@app/model/game-session';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSessionController } from './game-session.controller';

describe('GameSessionController', () => {
  let controller: GameSessionController;
  let service: GameSessionService;

  const mockGameSessionService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameSessionController],
      providers: [
        {
          provide: GameSessionService,
          useValue: mockGameSessionService,
        },
      ],
    }).compile();

    controller = module.get<GameSessionController>(GameSessionController);
    service = module.get<GameSessionService>(GameSessionService);
  });

  describe('create', () => {
    it('doit appeler service.create et retourner une session de jeu', async () => {
      const dto: CreateGameSessionDto = { gameId: '697b866e802124cfdcaa01b4' };
      const mockSession: GameSession = { gameId: dto.gameId, players: [] } as GameSession;

      mockGameSessionService.create.mockResolvedValue(mockSession);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockSession);
    });

    it('doit rejeter avec BadRequestException si gameId est manquant', async () => {
      const dto = {} as CreateGameSessionDto;

      mockGameSessionService.create.mockRejectedValue(new BadRequestException('L\'identifiant ne peut pas être vide'));

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('doit rejeter avec BadRequestException si gameId est une chaîne vide', async () => {
      const dto: CreateGameSessionDto = { gameId: '' };

      mockGameSessionService.create.mockRejectedValue(new BadRequestException('L\'identifiant ne peut pas être vide'));

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('doit rejeter avec BadRequestException si service.create échoue', async () => {
      const dto: CreateGameSessionDto = { gameId: 'invalidId' };

      mockGameSessionService.create.mockRejectedValue(new BadRequestException('Données invalides'));

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });
});

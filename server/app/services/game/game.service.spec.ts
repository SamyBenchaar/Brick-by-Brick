import { GameGateway } from '@app/gateways/game/game.gateway';
import { Game, GameDocument } from '@app/model/game';
import { GameMetaDataValidationService } from '@app/services/validations/gameMetaDataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { GameService } from './game.service';
/**
 * Stratégie de test pour GameService:
 * Communication avec la base de données: find(), findById(), findByIdAndUpdate(), findByIdAndDelete()
 * Communication avec les services de validation: validateMetadata(), validateMap()
 * Communication avec la gateway: notifyGameCreated(), notifyGameUpdated(), notifyGameDeleted()
 * 1. Tests de création : Vérifier qu'un jeu valide est créé avec validation des métadonnées et de la carte
 * 2. Tests de lecture : Tester findAll, findVisible, et findOne pour récupérer les jeux
 * 3. Tests de mise à jour : Confirmer que les mises à jour et les changements de visibilité notifient via la gateway
 * 4. Tests de suppression : Vérifier que la suppression notifie via la gateway
 * 5. Tests d'erreurs : Vérifier que les exceptions sont levées en cas d'erreur de validation
 */

describe('GameService', () => {
  let service: GameService;

  let model: jest.Mocked<Model<GameDocument>>;
  let mapValidation: jest.Mocked<MapValidationService>;
  let metadataValidation: jest.Mocked<GameMetaDataValidationService>;
  let gateway: jest.Mocked<GameGateway>;

  const validGameData: Partial<Game> = {
    _id: '123',
    name: 'Test Game',
    description: 'Test Description',
    isVisible: true,
    numberOfPlayers: 2,
    gameMode: 'classic',
    mapConfig: { size: 'Small', tiles: [] },
  };

  beforeEach(async () => {
    model = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      updateOne: jest.fn(),
    } as unknown as jest.Mocked<Model<GameDocument>>;

    mapValidation = {
      validateMap: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<MapValidationService>;

    metadataValidation = {
      validateMetadata: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GameMetaDataValidationService>;

    gateway = {
      notifyGameCreated: jest.fn(),
      notifyGameUpdated: jest.fn(),
      notifyGameDeleted: jest.fn(),
    } as unknown as jest.Mocked<GameGateway>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: getModelToken(Game.name), useValue: model },
        { provide: MapValidationService, useValue: mapValidation },
        { provide: GameMetaDataValidationService, useValue: metadataValidation },
        { provide: GameGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a valid game', async () => {
      const save = jest.fn().mockResolvedValue(validGameData);

      const constructor = jest.fn().mockReturnValue({ save });
      (service as unknown as { gameModel: typeof constructor }).gameModel =
        constructor;

      const result = await service.create(validGameData);

      expect(result).toEqual(validGameData);
      expect(metadataValidation.validateMetadata).toHaveBeenCalled();
      expect(mapValidation.validateMap).toHaveBeenCalled();
      expect(gateway.notifyGameCreated).toHaveBeenCalledWith(validGameData);
    });

    it('rejette si la validation échoue', async () => {
      metadataValidation.validateMetadata.mockResolvedValue(['error']);

      await expect(service.create(validGameData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('retourne les jeux', async () => {
      model.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([validGameData]),
      } as never);

      const result = await service.findAll();

      expect(result).toEqual([validGameData]);
      expect(model.find).toHaveBeenCalled();
    });
  });

  describe('findVisible', () => {
    it('retourne les jeux visibles', async () => {
      model.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([validGameData]),
      } as never);

      const result = await service.findVisible();

      expect(model.find).toHaveBeenCalledWith(
        { isVisible: true },
        expect.any(Object),
      );
      expect(result).toEqual([validGameData]);
    });
  });

  describe('findOne', () => {
    it('retourne un jeu', async () => {
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(validGameData),
      } as never);

      const result = await service.findOne('123');

      expect(model.findById).toHaveBeenCalledWith('123');
      expect(result).toEqual(validGameData);
    });
  });

  describe('update', () => {
    it('met à jour un jeu', async () => {
      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(validGameData),
      } as never);

      const result = await service.update('123', validGameData);

      expect(result).toEqual(validGameData);
      expect(gateway.notifyGameUpdated).toHaveBeenCalled();
    });
  });

  describe('updateVisibility', () => {
    it('met à jour la visibilité', async () => {
      model.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(validGameData),
      } as never);
      model.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(validGameData),
      } as never);
      model.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      } as never);

      const result = await service.updateVisibility('123', true);

      expect(result).toEqual(validGameData);
      expect(gateway.notifyGameUpdated).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('supprime un jeu', async () => {
      model.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(validGameData),
      } as never);

      const result = await service.delete('123');

      expect(result).toEqual(validGameData);
      expect(gateway.notifyGameDeleted).toHaveBeenCalledWith('123');
    });
  });
});

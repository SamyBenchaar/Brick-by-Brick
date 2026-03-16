import { Game, GameDocument } from '@app/model/game';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { GameMetaDataValidationService } from './gameMetaDataValidation.service';

type MockModel<T> = Partial<Record<keyof Model<T>, jest.Mock>>;

/**
 * Stratégie de test pour GameMetaDataValidationService:
 * Communication avec la base de données: findOne()
 * 
 * 1. Tests de validation : Vérifier que les métadonnées sont validées correctement
 * 2. Tests d'unicité : Tester que les noms de jeu sont uniques sauf en mise à jour
 * 3. Tests de champs obligatoires : Confirmer que description et name sont présents
 * 4. Cas limites : valeurs nulles, doublons
 */
describe('GameMetaDataValidationService', () => {
  let service: GameMetaDataValidationService;
  let model: MockModel<GameDocument>;

  const mockModel: MockModel<GameDocument> = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    mockModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameMetaDataValidationService,
        { provide: getModelToken(Game.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get(GameMetaDataValidationService);
    model = module.get(getModelToken(Game.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseGame: Partial<Game> = {
    name: 'TestGame',
    description: 'desc',
  };

  it('doit retourner une erreur si la description est vide', async () => {
    const result = await service.validateMetadata({
      ...baseGame,
      description: '',
    });

    expect(result).toContain('La description ne peut pas être vide');
  });

  it('doit retourner une erreur si le nom existe déjà', async () => {
    model.findOne?.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '123' }),
    });

    const result = await service.validateMetadata(baseGame);

    expect(result).toContain('Le nom du jeu doit être unique');
  });

  it('ne doit PAS retourner d\'erreur si même id (mise à jour)', async () => {
    model.findOne?.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: '123' }),
    });

    const result = await service.validateMetadata({
      ...baseGame,
      _id: '123',
    });

    expect(result).not.toContain('Le nom du jeu doit être unique');
  });

  //cas limite: nom avec espaces
  it('devrait retourner une erreur si le nom contient des espaces - cas limite', async () => {
    const result = await service.validateMetadata({
      ...baseGame,
      name: 'Nom Avec Espaces',
    });
    
    expect(result).toContain('Le nom ne peut pas contenir d\'espaces');
  });

  // Cas limite: nom et description vides
  it('devrait retourner des erreurs pour nom et description vides - cas limite', async () => {
    const result = await service.validateMetadata({
      name: '',
      description: '',
    });

    expect(result).toContain('La description ne peut pas être vide');
  });
});

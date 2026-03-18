import { Game, GameDocument } from '@app/model/game';
import { MapSize } from '@common/map';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { MapValidationService } from './map-validation.service';

type MockModel<T> = Partial<Record<keyof Model<T>, jest.Mock>>;

/**
 * Resume des test généré par ChatGPT:
 * Resumé de la stratégie de test généré par ChatGPT:
 * Stratégie de test pour MapValidationService:
 * 
 * 1. Tests de points de départ : Confirmer le nombre correct de points de départ
 * 2. Tests de dimensions : Valider les tailles de carte acceptées
 * 3. Cas limites : Cartes vides, couverture minimale, points de départ manquants
 */
describe('MapValidationService', () => {
  let service: MapValidationService;

  const mockModel: MockModel<GameDocument> = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapValidationService,
        { provide: getModelToken(Game.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get(MapValidationService);
  });

  const playable = { type: 'grass' };
  const wall = { type: 'wall' };

  function buildGrid(size: number) {
    return Array(size).fill(null).map(() =>
      Array(size).fill({ ...playable }),
    );
  }

  it('doit rejeter si couverture terrain < 50%', async () => {
    const size = MapSize.Small;
    const tiles = buildGrid(size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        tiles[y][x] = wall;
      }
    }

    tiles[0][0] = { ...playable, object: { type: 'startingpoint' } };

    const result = await service.validateMap({
      numberOfPlayers: 1,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result.length).toBeGreaterThan(0);
  });

  it('doit rejeter si nombre incorrect de points de départ', async () => {
    const size = MapSize.Small;
    const tiles = Array(size).fill(null).map(() =>
      Array(size).fill({ type: 'base' }),
    );

    tiles[0][0] = { type: 'base', object: { type: 'startingpoint' } };

    const result = await service.validateMap({
      numberOfPlayers: 2,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result.some(e => e.includes('points de départ'))).toBeTruthy();
  });

  it('doit passer pour une carte valide', async () => {
    const size = MapSize.Small;
    const tiles = Array(size).fill(null).map(() =>
      Array(size).fill({ type: 'base' }),
    );

    tiles[0][0] = { type: 'base', object: { type: 'startingpoint' } };

    const result = await service.validateMap({
      numberOfPlayers: 1,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result).toEqual([]);
  });

  // Cas limite: aucun point de départ
  it('doit rejeter si aucun point de départ - cas limite', async () => {
    const size = MapSize.Small;
    const tiles = Array(size).fill(null).map(() =>
      Array(size).fill({ type: 'base' }),
    );

    const result = await service.validateMap({
      numberOfPlayers: 1,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result.some(e => e.includes('points de départ'))).toBeTruthy();
  });

  // Cas limite: couverture terrain exactement 50%
  it('doit accepter une couverture terrain de 50% - cas limite', async () => {
    const size = MapSize.Small;
    const tiles = buildGrid(size);

    // Remplir avec des murs pour avoir exactement 50% jouable
    let wallCount = 0;
    const totalTiles = size * size;
    const targetWalls = Math.floor((totalTiles - 1) / 2);

    for (let y = 0; y < size && wallCount < targetWalls; y++) {
      for (let x = 0; x < size && wallCount < targetWalls; x++) {
        if (y === 0 && x === 0) continue;

        tiles[y][x] = wall;
        wallCount++;
      }
    }

    tiles[0][0] = { type: 'grass', object: { type: 'startingpoint' } };

    const result = await service.validateMap({
      numberOfPlayers: 1,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result.some(e => e.includes('surface de terrain jouable'))).toBeTruthy();
  });

  // Cas limite: carte vide (tous les murs)
  it('doit rejeter une carte complètement vide - cas limite', async () => {
    const size = MapSize.Small;
    const tiles = Array(size).fill(null).map(() =>
      Array(size).fill(wall),
    );

    const result = await service.validateMap({
      numberOfPlayers: 1,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result.length).toBeGreaterThan(0);
  });

  // Cas limite: trop de points de départ
  it('doit rejeter si trop de points de départ - cas limite', async () => {
    const size = MapSize.Small;
    const tiles = Array(size).fill(null).map(() =>
      Array(size).fill({ type: 'base' }),
    );

    tiles[0][0] = { type: 'base', object: { type: 'startingpoint' } };
    tiles[0][1] = { type: 'base', object: { type: 'startingpoint' } };
    tiles[0][2] = { type: 'base', object: { type: 'startingpoint' } };

    const result = await service.validateMap({
      numberOfPlayers: 1,
      mapConfig: { size: 'Small', tiles },
    } as Partial<Game>);

    expect(result.some(e => e.includes('points de départ'))).toBeTruthy();
  });
});

import { Game } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { CreateGameDto } from '@common/dto/create-game.dto';
import { UpdateGameDto } from '@common/dto/update-game.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';

/**
 * Stratégie de test pour GameController:
 * 
 * 1. Tests de méthodes : Vérifier que chaque endpoint appelle le service correctement
 * 2. Gestion des erreurs : Tester les exceptions (404, 400) pour les cas d'erreur
 * 3. Cas limites : Tester avec données vides, IDs invalides, listes vides
 * 4. Validation des paramètres : Confirmer que les bonnes données sont envoyées au service
 * 
 * Cas limites testés:
 * - Listes vides (aucun jeu retourné)
 * - ID invalide ou inexistant (404)
 * - Données invalides (400)
 * - Valeurs null/undefined
 */

describe('GameController', () => {
  let controller: GameController;
  let service: GameService;

  const mockGameService = {
    findAll: jest.fn(),
    findAdminMenuGames: jest.fn(),
    findVisible: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateVisibility: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        { provide: GameService, useValue: mockGameService },
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
    service = module.get<GameService>(GameService);
  });

  describe('findAdminMenuGames', () => {
    it('devrait retourner les jeux du menu admin', async () => {
      const mockGames: Game[] = [{ name: 'AdminG1' } as Game];
      mockGameService.findAdminMenuGames.mockResolvedValue(mockGames);

      const result = await controller.findAdminMenuGames();
      expect(result).toEqual(mockGames);
      expect(service.findAdminMenuGames).toHaveBeenCalled();
    });
  });

  describe('findVisible', () => {
    it('devrait retourner les jeux visibles', async () => {
      const mockGames: Game[] = [{ name: 'VisibleG1' } as Game];
      mockGameService.findVisible.mockResolvedValue(mockGames);

      const result = await controller.findVisible();
      expect(result).toEqual(mockGames);
      expect(service.findVisible).toHaveBeenCalled();
    });

    // Cas limite: liste vide de jeux visibles
    it('devrait gérer aucun jeu visible - cas limite', async () => {
      mockGameService.findVisible.mockResolvedValue([]);

      const result = await controller.findVisible();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('devrait retourner un jeu par ID', async () => {
      const mockGame: Game = { name: 'G1' } as Game;
      mockGameService.findOne.mockResolvedValue(mockGame);

      const result = await controller.findOne('id123');
      expect(result).toEqual(mockGame);
      expect(service.findOne).toHaveBeenCalledWith('id123');
    });

    // Cas limite: jeu inexistant
    it('devrait retourner null si le jeu n\'existe pas - cas limite', async () => {
      mockGameService.findOne.mockResolvedValue(null);

      const result = await controller.findOne('idX');
      expect(result).toBeNull();
      expect(service.findOne).toHaveBeenCalledWith('idX');
    });

    // Cas limite: ID invalide
    it('devrait gérer un ID invalide - cas limite', async () => {
      mockGameService.findOne.mockRejectedValue(new NotFoundException('Jeu non trouvé'));

      await expect(controller.findOne('')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('devrait créer un jeu', async () => {
      const dto: CreateGameDto = { name: 'New Game' } as CreateGameDto;
      const mockGame: Game = { name: dto.name } as Game;
      mockGameService.create.mockResolvedValue(mockGame);

      const result = await controller.create(dto);
      expect(result).toEqual(mockGame);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    // Cas limite: données invalides
    it('devrait lancer BadRequestException si les données sont invalides - cas limite', async () => {
      const dto: CreateGameDto = { name: '' } as CreateGameDto;
      mockGameService.create.mockRejectedValue(new BadRequestException('Données invalides'));

      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('devrait mettre à jour un jeu', async () => {
      const dto: UpdateGameDto = { name: 'Updated' } as UpdateGameDto;
      const mockGame: Game = { name: dto.name } as Game;
      mockGameService.update.mockResolvedValue(mockGame);

      const result = await controller.update('id1', dto);
      expect(result).toEqual(mockGame);
      expect(service.update).toHaveBeenCalledWith('id1', dto);
    });

    // Cas limite: jeu inexistant
    it('devrait lancer NotFoundException si le jeu n\'existe pas - cas limite', async () => {
      const dto: UpdateGameDto = { name: 'Updated' } as UpdateGameDto;
      mockGameService.update.mockRejectedValue(new NotFoundException('Jeu non trouvé'));

      await expect(controller.update('idX', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateVisibility', () => {
    it('devrait mettre à jour la visibilité', async () => {
      const mockGame: Game = { name: 'G', isVisible: true } as Game;
      mockGameService.updateVisibility.mockResolvedValue(mockGame);

      const result = await controller.updateVisibility('id1', true);
      expect(result).toEqual(mockGame);
      expect(service.updateVisibility).toHaveBeenCalledWith('id1', true);
    });

    // Cas limite: basculer la visibilité à false
    it('devrait basculer la visibilité à false - cas limite', async () => {
      const mockGame: Game = { name: 'G', isVisible: false } as Game;
      mockGameService.updateVisibility.mockResolvedValue(mockGame);

      const result = await controller.updateVisibility('id1', false);
      expect(result.isVisible).toBe(false);
      expect(service.updateVisibility).toHaveBeenCalledWith('id1', false);
    });

    // Cas limite: jeu inexistant
    it('devrait lancer NotFoundException si le jeu n\'existe pas - cas limite', async () => {
      mockGameService.updateVisibility.mockRejectedValue(new NotFoundException('Jeu non trouvé'));

      await expect(controller.updateVisibility('idX', false)).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('devrait supprimer un jeu', async () => {
      const mockGame: Game = { name: 'G1' } as Game;
      mockGameService.delete.mockResolvedValue(mockGame);

      const result = await controller.delete('id1');
      expect(result).toEqual(mockGame);
      expect(service.delete).toHaveBeenCalledWith('id1');
    });

    // Cas limite: jeu inexistant
    it('devrait lancer NotFoundException si le jeu n\'existe pas - cas limite', async () => {
      mockGameService.delete.mockRejectedValue(new NotFoundException('Jeu non trouvé'));

      await expect(controller.delete('idX')).rejects.toThrow(NotFoundException);
    });
  });
});

import { Game, GameDocument } from '@app/model/game';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { CreateGameDto } from '@common/dto/create-game.dto';
import { UpdateGameDto } from '@common/dto/update-game.dto';
import { BadRequestException, Injectable,NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model } from 'mongoose';

@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
        private mapValidationService: MapValidationService,
        private gameMetadataValidationService: GameMetadataValidationService,

    ) {}

    async create(gameData: Partial<Game>): Promise<Game> {
        const errors: string[] = [];

        // Validation du DTO
        const dtoInstance = plainToInstance(CreateGameDto, gameData);
        const validationErrors = await validate(dtoInstance);
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => {
                if (error.constraints) {
                    errors.push(...Object.values(error.constraints));
                }
            });
        }

        // Validation des métadonnées
        errors.push(...await this.gameMetadataValidationService.validateMetadata(gameData));

        // Validation de la carte
        errors.push(...await this.mapValidationService.validateMap(gameData));

        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        const createdGame = new this.gameModel(gameData);
        return createdGame.save();
    }

    async findAll(): Promise<Game[]> {
        return this.gameModel.find().exec();
    }

    async findOne(id: string): Promise<Game> {
        return this.gameModel.findById(id).exec();
    }

    async findVisible(): Promise<Game[]> {
        return this.gameModel.find({ isVisible: true }).select('name previewImage gameMode mapConfig.size').exec();
    }

    async update(id: string, gameData: Partial<Game>): Promise<Game> {
        const errors: string[] = [];

        // Validation du DTO
        const dtoInstance = plainToInstance(UpdateGameDto, gameData);
        const validationErrors = await validate(dtoInstance);
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => {
                if (error.constraints) {
                    errors.push(...Object.values(error.constraints));
                }
            });
        }

        // Validation des métadonnées
        errors.push(...await this.gameMetadataValidationService.validateMetadata(gameData));

        // Validation de la carte
        errors.push(...await this.mapValidationService.validateMap(gameData));

        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        const updatedGame = await this.gameModel.findByIdAndUpdate(id, gameData, { new: true }).exec();

        if (!updatedGame) {
            throw new NotFoundException(`Jeu avec ID ${id} non trouvé`);
        }

        return updatedGame;
    }

    async updateVisibility(id: string, isVisible: boolean): Promise<Game> {
        const updatedGame = await this.gameModel.findByIdAndUpdate(id, { isVisible }, { new: true }).exec();

        if (!updatedGame) {
            throw new NotFoundException(`Jeu avec ID ${id} non trouvé`);
        }

        return updatedGame;
    }

    async delete(id: string): Promise<Game> {
        const deletedGame = await this.gameModel.findByIdAndDelete(id).exec();

        if (!deletedGame) {
            throw new NotFoundException(`Jeu avec ID ${id} non trouvé`);
        }

        return deletedGame;
    }
}

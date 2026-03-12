import { CreateGameDto } from '@app/dto/create-game.dto';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { Game, GameDocument } from '@app/model/game';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
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
        @Inject(forwardRef(() => GameGateway))
        private gameGateway: GameGateway,
    ) {}

    private async validateGameData(gameData: Partial<Game>): Promise<string[]> {
        const errors: string[] = [];

        const dtoInstance = plainToInstance(CreateGameDto, gameData);
        const validationErrors = await validate(dtoInstance);
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => {
                if (error.constraints) {
                    errors.push(...Object.values(error.constraints));
                }
            });
        }

        errors.push(...await this.gameMetadataValidationService.validateMetadata(gameData));

        errors.push(...await this.mapValidationService.validateMap(gameData));

        return errors;
    }

    async create(gameData: Partial<Game>): Promise<Game> {
        const errors = await this.validateGameData(gameData);
        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        const createdGame = new this.gameModel(gameData);
        const savedGame = await createdGame.save();

        if (this.gameGateway) {
            this.gameGateway.notifyGameCreated(savedGame);
        }

        return savedGame;
    }

    async findAll(): Promise<Game[]> {
        return this.gameModel.find().exec();
    }

    async findAdminMenuGames(): Promise<Game[]> {
        return this.gameModel.find({}, {
            _id: 1, name: 1, mapConfig: { size: 1 }, lastModified: 1, isVisible: 1,
            description: 1, previewImage: 1,
        }).exec();
    }

    async findVisible(): Promise<Game[]> {
        return this.gameModel.find({ isVisible: true }, {
            _id: 1, name: 1, mapConfig: { size: 1 }, lastModified: 1, isVisible: 1,
            description: 1, previewImage: 1,
        }).exec();
    }

    async findOne(id: string): Promise<Game> {
        return this.gameModel.findById(id).exec();
    }

    async update(id: string, gameData: Partial<Game>): Promise<Game> {
        const errors = await this.validateGameData(gameData);
        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        const updatedGame = await this.gameModel.findByIdAndUpdate(id, gameData, { new: true }).exec();
        if (!updatedGame) {
            throw new NotFoundException(`Jeu avec ID ${id} non trouvé`);
        }

        if (this.gameGateway && updatedGame) {
            this.gameGateway.notifyGameUpdated(updatedGame);
        }

        return updatedGame;
    }

    async updateVisibility(id: string, isVisible: boolean): Promise<Game> {
        const updatedGame = await this.gameModel.findByIdAndUpdate(id, { isVisible }, { new: true }).exec();

        if (this.gameGateway && updatedGame) {
            this.gameGateway.notifyGameUpdated(updatedGame);
        }

        return updatedGame;
    }

    async delete(id: string): Promise<Game> {
        const deletedGame = await this.gameModel.findByIdAndDelete(id).exec();

        if (this.gameGateway && deletedGame) {
            this.gameGateway.notifyGameDeleted(id);
        }

        return deletedGame;
    }
}

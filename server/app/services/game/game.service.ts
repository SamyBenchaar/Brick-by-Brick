import { Game, GameDocument } from '@app/model/game';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
        private mapValidationService: MapValidationService,
        private gameMetadataValidationService: GameMetadataValidationService,

    ) {}

    async create(gameData: Partial<Game>): Promise<Game> {
        await this.gameMetadataValidationService.validateMetadata(gameData);
        await this.mapValidationService.validateMap(gameData);

        const createdGame = new this.gameModel(gameData);
        return createdGame.save();
    }

    async findAll(): Promise<Game[]> {
        return this.gameModel.find().exec();
    }

    async findOne(id: string): Promise<Game> {
        return this.gameModel.findById(id).exec();
    }

    async update(id: string, gameData: Partial<Game>): Promise<Game> {
        await this.gameMetadataValidationService.validateMetadata(gameData);
        await this.mapValidationService.validateMap(gameData);

        return this.gameModel.findByIdAndUpdate(id, gameData, { new: true }).exec();
    }

    async delete(id: string): Promise<Game> {
        return this.gameModel.findByIdAndDelete(id).exec();
    }
}

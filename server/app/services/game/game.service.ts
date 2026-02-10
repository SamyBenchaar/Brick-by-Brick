import { GameGateway } from '@app/gateways/game/game.gateway';
import { Game, GameDocument } from '@app/model/game';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
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

    async create(gameData: Partial<Game>): Promise<Game> {
        const metadataErrors = await this.gameMetadataValidationService.validateMetadata(gameData);
        const mapErrors = await this.mapValidationService.validateMap(gameData);

        const errors = [...metadataErrors, ...mapErrors];
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
        return this.gameModel.find().exec();
    }

    async findVisible(): Promise<Game[]> {
        return this.gameModel.find({ isVisible: true }).exec();
    }

    async findOne(id: string): Promise<Game> {
        return this.gameModel.findById(id).exec();
    }

    async update(id: string, gameData: Partial<Game>): Promise<Game> {
        const metadataErrors = await this.gameMetadataValidationService.validateMetadata(gameData);
        const mapErrors = await this.mapValidationService.validateMap(gameData);

        const errors = [...metadataErrors, ...mapErrors];
        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        const updatedGame = await this.gameModel.findByIdAndUpdate(id, gameData, { new: true }).exec();

        if (this.gameGateway && updatedGame) {
            this.gameGateway.notifyGameUpdated(updatedGame);
        }

        return updatedGame;
    }

    async updateVisibility(id: string, isVisible: boolean): Promise<Game> {
        return this.gameModel.findByIdAndUpdate(id, { isVisible }, { new: true }).exec();
    }

    async delete(id: string): Promise<Game> {
        const deletedGame = await this.gameModel.findByIdAndDelete(id).exec();

        if (this.gameGateway && deletedGame) {
            this.gameGateway.notifyGameDeleted(id);
        }

        return deletedGame;
    }
}

import { Game, GameDocument } from '@app/model/game';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GameMetadataValidationService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    ) {}

    async validateMetadata(gameData: Partial<Game>): Promise<void> {
        if (!gameData.description || gameData.description.trim() === '') {
            throw new BadRequestException('La description ne peut pas être vide');
        }
        const existingGame = await this.gameModel.findOne({ name: gameData.name }).exec();
        if (existingGame && gameData._id && existingGame._id.toString() === gameData._id.toString()) {
            return;
        }
        if (existingGame) {
            throw new BadRequestException('Le nom du jeu doit être unique');
        }

    }

}

import { Game, GameDocument } from '@app/model/game';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GameMetadataValidationService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    ) {}

    async validateMetadata(gameData: Partial<Game>): Promise<string[]> {
        const errors: string[] = [];

        if (!gameData.description || gameData.description.trim() === '') {
            errors.push('La description ne peut pas être vide');
        }

        const existingGame = await this.gameModel.findOne({ name: gameData.name }).exec();
        if (existingGame && (!gameData._id || existingGame._id.toString() !== gameData._id.toString())) {
            errors.push('Le nom du jeu doit être unique');
        }

        return errors;
    }

}

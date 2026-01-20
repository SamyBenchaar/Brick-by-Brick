import { Game, GameDocument } from '@app/model/database/game';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable() 
export class GameService {
    constructor(
        @InjectModel(Game.name) private gameModel: Model<GameDocument>,
    ) {}

    async create(gameData: Partial<Game>): Promise<Game> {
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
        return this.gameModel.findByIdAndUpdate(id, gameData, { new: true }).exec();
    }

    async delete(id: string): Promise<Game> {
        return this.gameModel.findByIdAndDelete(id).exec();
    }
}

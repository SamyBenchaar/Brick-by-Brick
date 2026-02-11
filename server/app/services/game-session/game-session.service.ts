import { CreateGameSessionDto } from '@app/dto/create-game-session.dto';
import { GameSession } from '@app/model/game-session';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GameSessionService {
    constructor(@InjectModel(GameSession.name) private gameSessionModel: Model<GameSession>) {}

    async create(createGameSessionDto: CreateGameSessionDto): Promise<GameSession> {
        const createdGameSession = new this.gameSessionModel({
            gameId: createGameSessionDto.gameId,
            players: [],
        });
        return createdGameSession.save();
    }
}

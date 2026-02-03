import { GameSession } from '@app/model/game-session';
import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateGameSessionDto } from '@common/dto/create-game-session.dto';

@Injectable()
export class GameSessionService {
    constructor(@InjectModel(GameSession.name) private gameSessionModel: Model<GameSession>) {}
    
    async create(createGameSessionDto: CreateGameSessionDto): Promise<GameSession> {
        console.log('Received createGameSessionDto:', createGameSessionDto);
            const createdGameSession = new this.gameSessionModel({
                gameId: createGameSessionDto.gameId,
                players: [],
            });
            console.log('Creating game session with data:', createdGameSession);
            return createdGameSession.save();
        }
}

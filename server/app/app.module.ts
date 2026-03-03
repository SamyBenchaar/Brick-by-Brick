import { GameController } from '@app/controllers/game/game.controller';
import { Game, gameSchema } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameGateway } from './gateways/game/game.gateway';
import { GameSessionGateway } from './gateways/gameSession/game-session.gateway';
import { GameSessionService } from './services/gameSession/gameSession.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'), // Loaded from .env
            }),
        }),
        MongooseModule.forFeature([
            { name: Game.name, schema: gameSchema },
        ]), 
    ],
    controllers: [GameController],
    providers: [GameGateway, GameSessionGateway, GameService, GameSessionService, Logger, MapValidationService, GameMetadataValidationService],
})
export class AppModule {
    constructor(
        private readonly gameGateway: GameGateway,
        private readonly gameService: GameService,

    ) {}
}


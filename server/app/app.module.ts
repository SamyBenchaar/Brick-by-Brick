import { GameController } from '@app/controllers/game/game.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameSessionGateway } from '@app/gateways/gameSession/game-session.gateway';
import { Game, gameSchema } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { CombatService } from '@app/services/gameSession/combat.service';
import { MovementService } from '@app/services/gameSession/movement.service';
import { StartingPointService } from '@app/services/gameSession/starting-point.service';
import { TurnManagementService } from '@app/services/gameSession/turn-management.service';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameGateway } from './gateways/game/game.gateway';
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
    providers: [
        GameGateway,
        GameSessionGateway,
        ChatGateway,
        GameService,
        GameSessionService,
        StartingPointService,
        TurnManagementService,
        MovementService,
        CombatService,
        Logger,
        MapValidationService,
        GameMetadataValidationService,
    ],
})
export class AppModule {
    constructor(
        private readonly gameGateway: GameGateway,
        private readonly gameService: GameService,

    ) {}
}



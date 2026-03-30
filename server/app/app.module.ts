import { GameController } from '@app/controllers/game/game.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GamePlayGateway } from '@app/gateways/game-session/game-play/game-play.gateway';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { Game, gameSchema } from '@app/model/game';
import { CombatService } from '@app/services/game-session/combat.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { GameMetadataValidationService } from '@app/services/validations/game-metadata-validation.service';
import { MapValidationService } from '@app/services/validations/map-validation.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameSessionService } from './services/game-session/game-session/game-session.service';
import { GameService } from './services/game/game.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        MongooseModule.forFeature([
            { name: Game.name, schema: gameSchema },
        ]),
    ],
    controllers: [GameController],
    providers: [
        GameService,
        GameGateway,
        GameSessionGateway,
        GamePlayGateway,
        ChatGateway,
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
export class AppModule {}



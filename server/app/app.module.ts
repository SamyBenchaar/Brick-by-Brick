import { GameController } from '@app/controllers/game/game.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { GamePlayGateway } from '@app/gateways/gameSession/game-play.gateway';
import { GameSessionGateway } from '@app/gateways/gameSession/game-session.gateway';
import { Game, gameSchema } from '@app/model/game';
import { CombatService } from '@app/services/gameSession/combat.service';
import { MovementService } from '@app/services/gameSession/movement.service';
import { StartingPointService } from '@app/services/gameSession/starting-point.service';
import { TurnManagementService } from '@app/services/gameSession/turn-management.service';
import { GameMetaDataValidationService } from '@app/services/validations/gameMetaDataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameService } from './services/game/game.service';
import { GameSessionService } from './services/gameSession/gameSession.service';

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
        GameMetaDataValidationService,
    ],
})
export class AppModule {}



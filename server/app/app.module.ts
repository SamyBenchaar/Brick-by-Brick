import { GameController } from '@app/controllers/game/game.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { Game, gameSchema } from '@app/model/game';
import { DateService } from '@app/services/date/date.service';
import { GameService } from '@app/services/game/game.service';
import { GameMetadataValidationService } from '@app/services/validations/gameMetadataValidation.service';
import { MapValidationService } from '@app/services/validations/mapValidation.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameSessionModule } from './game-session.module';

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
        ]), GameSessionModule
    ],
    controllers: [GameController],
    providers: [ChatGateway, GameService, DateService, Logger, MapValidationService, GameMetadataValidationService],
})
export class AppModule {}

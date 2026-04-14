import { GameController } from '@app/controllers/game/game.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { GamePlayCombatHandler } from '@app/gateways/game-session/game-play/game-play-combat.handler';
import { GamePlayCtfHandler } from '@app/gateways/game-session/game-play/game-play-ctf.handler';
import { GamePlayHandlersProvider } from '@app/gateways/game-session/game-play/game-play-handlers.provider';
import { GamePlayMovementHandler } from '@app/gateways/game-session/game-play/game-play-movement.handler';
import { GamePlaySanctuaryHandler } from '@app/gateways/game-session/game-play/game-play-sanctuary.handler';
import { GamePlayAbandonHandler } from '@app/gateways/game-session/game-play/game-playa-abandon.handler';
import { GamePlayTurnHandler } from '@app/gateways/game-session/game-play/game-play-turn.handler';
import { GamePlayGateway } from '@app/gateways/game-session/game-play/game-play.gateway';
import { GameSessionGateway } from '@app/gateways/game-session/game-session/game-session.gateway';
import { GameGateway } from '@app/gateways/game/game.gateway';
import { LogGateway } from '@app/gateways/log/log.gateway';
import { Game, gameSchema } from '@app/model/game';
import { CombatService } from '@app/services/game-session/combat.service';
import { CombatEndService } from '@app/services/game-session/combat/combat-end.service';
import { CombatRequestValidatorService } from '@app/services/game-session/combat/combat-request-validator.service';
import { CombatRoundService } from '@app/services/game-session/combat/combat-round.service';
import { MovementService } from '@app/services/game-session/movement.service';
import { StartingPointService } from '@app/services/game-session/starting-point.service';
import { TurnManagementService } from '@app/services/game-session/turn-management.service';
import { VirtualPlayerCtfService } from '@app/services/game-session/virtual-player-ctf.service';
import { VirtualPlayerMechanicsService } from '@app/services/game-session/virtual-player-mechanics.service';
import { VirtualPlayerPathfindingService } from '@app/services/game-session/virtual-player-mechanics/virtual-player-pathfinding.service';
import { VirtualPlayerTargetingService } from '@app/services/game-session/virtual-player-mechanics/virtual-player-targeting.service';
import { VirtualPlayerService } from '@app/services/game-session/virtual-player.service';
import { LogService } from '@app/services/log/log.service';
import { GameMetadataValidationService } from '@app/services/validations/game-metadata-validation.service';
import { MapValidationService } from '@app/services/validations/map-validation.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameSessionService } from './services/game-session/game-session/game-session.service';
import { SanctuaryService } from './services/game-session/sanctuary.service';
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
        GamePlayCombatHandler,
        GamePlayMovementHandler,
        GamePlayCtfHandler,
        GamePlayTurnHandler,
        GamePlayHandlersProvider,
        GamePlaySanctuaryHandler,
        GamePlayAbandonHandler,
        ChatGateway,
        LogGateway,
        LogService,
        GameSessionService,
        StartingPointService,
        TurnManagementService,
        MovementService,
        VirtualPlayerPathfindingService,
        VirtualPlayerTargetingService,
        VirtualPlayerCtfService,
        VirtualPlayerMechanicsService,
        VirtualPlayerService,
        CombatService,
        CombatRequestValidatorService,
        CombatRoundService,
        CombatEndService,
        Logger,
        SanctuaryService,
        MapValidationService,
        GameMetadataValidationService,
    ],
})
export class AppModule {}



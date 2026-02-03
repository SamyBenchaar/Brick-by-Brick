import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameSession, gameSessionSchema } from '@app/model/game-session';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameSessionController } from '@app/controllers/game-session/game-session.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GameSession.name, schema: gameSessionSchema }])
  ],
  controllers: [GameSessionController],
  providers: [GameSessionService],
  exports: [GameSessionService],
})
export class GameSessionModule {}

import { CreateGameSessionDto } from '@app/dto/create-game-session.dto';
import { GameSession } from '@app/model/game-session';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('game-sessions')
@Controller('game-sessions')
export class GameSessionController {
    constructor(private readonly gameSessionService: GameSessionService) {}

    @Post()
    @ApiOperation({ summary: 'Créer une nouvelle partie' })
    @ApiResponse({ status: 201, description: 'Partie créée avec succès', type: GameSession })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async create(@Body(new ValidationPipe({ transform: true })) createGameSessionDto: CreateGameSessionDto): Promise<GameSession> {
        return this.gameSessionService.create(createGameSessionDto);
    }
}

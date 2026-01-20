import { Game } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameService } from '@app/services/game/game.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('games')
@Controller('games')
export class GameController {
    constructor(private readonly gameService: GameService) {}

    @Get()
    @ApiOperation({ summary: 'Récupérer tous les jeux' })
    @ApiResponse({ status: 200, description: 'Liste des jeux retournée avec succès' })
    async findAll(): Promise<Game[]> {
        return this.gameService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Récupérer un jeu par ID' })
    @ApiResponse({ status: 200, description: 'Jeu retourné avec succès' })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async findOne(@Param('id') id: string): Promise<Game> {
        return this.gameService.findOne(id);
    }

    @Post()
    @ApiOperation({ summary: 'Créer un nouveau jeu' })
    @ApiResponse({ status: 201, description: 'Jeu créé avec succès', type: Game })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async create(@Body(new ValidationPipe({ transform: true })) createGameDto: CreateGameDto): Promise<Game> {
        return this.gameService.create(createGameDto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Mettre à jour un jeu' })
    @ApiResponse({ status: 200, description: 'Jeu mis à jour avec succès', type: Game })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async update(@Param('id') id: string, @Body(new ValidationPipe({ transform: true })) updateGameDto: UpdateGameDto): Promise<Game> {
        return this.gameService.update(id, updateGameDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer un jeu' })
    @ApiResponse({ status: 200, description: 'Jeu supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async delete(@Param('id') id: string): Promise<Game> {
        return this.gameService.delete(id);
    }
}

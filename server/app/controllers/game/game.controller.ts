import { Game } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
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
    @ApiResponse({ status: 201, description: 'Jeu créé avec succès' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async create(@Body() gameData: Partial<Game>): Promise<Game> {
        return this.gameService.create(gameData);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Mettre à jour un jeu' })
    @ApiResponse({ status: 200, description: 'Jeu mis à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async update(@Param('id') id: string, @Body() gameData: Partial<Game>): Promise<Game> {
        return this.gameService.update(id, gameData);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer un jeu' })
    @ApiResponse({ status: 200, description: 'Jeu supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async delete(@Param('id') id: string): Promise<Game> {
        return this.gameService.delete(id);
    }
}

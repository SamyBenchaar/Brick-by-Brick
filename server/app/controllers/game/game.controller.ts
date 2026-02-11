import { CreateGameDto } from '@app/dto/create-game.dto';
import { Game } from '@app/model/game';
import { GameService } from '@app/services/game/game.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('games')
@Controller('games')
export class GameController {
    constructor(private readonly gameService: GameService) {}

    @Get('admin')
    @ApiOperation({ summary: 'Récupérer tous les jeux pour le menu admin' })
    @ApiResponse({ status: 200, description: 'Liste des jeux retournée avec succès' })
    async findAdminMenuGames(): Promise<Game[]> {
        return this.gameService.findAdminMenuGames();
    }

    @Get('visible')
    @ApiOperation({ summary: 'Récupérer les jeux visibles' })
    async findVisible(): Promise<Game[]> {
        return this.gameService.findVisible();
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
    async create(@Body() createGameDto: CreateGameDto): Promise<Game> {
        return this.gameService.create(createGameDto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Mettre à jour un jeu' })
    @ApiResponse({ status: 200, description: 'Jeu mis à jour avec succès', type: Game })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async update(@Param('id') id: string, @Body() updateGameDto: CreateGameDto): Promise<Game> {
        return this.gameService.update(id, updateGameDto);
    }

    @Patch(':id/visibility')
    @ApiOperation({ summary: 'Modifier la visibilité d\'un jeu' })
    @ApiResponse({ status: 200, description: 'Visibilité mise à jour avec succès', type: Game })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async updateVisibility(@Param('id') id: string, @Body('isVisible') isVisible: boolean): Promise<Game> {
        return this.gameService.updateVisibility(id, isVisible);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Supprimer un jeu' })
    @ApiResponse({ status: 200, description: 'Jeu supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Jeu non trouvé' })
    async delete(@Param('id') id: string): Promise<Game> {
        return this.gameService.delete(id);
    }
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MapConfigDto } from './map-config.dto';
import { MapObjectsDto } from './map-objects.dto';
import { TileDto } from './tile.dto';

export class CreateGameDto {
    @ApiProperty({ description: 'Nom du jeu', example: 'Mon Premier Jeu' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Description du jeu', example: 'Un jeu de test' })
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ description: 'Visibilité du jeu', example: false })
    @IsBoolean()
    isVisible: boolean;

    @ApiProperty({ description: 'Configuration de la carte', type: MapConfigDto })
    @ValidateNested()
    @Type(() => MapConfigDto)
    @IsNotEmpty()
    mapConfig: MapConfigDto;

    @ApiProperty({ description: 'Grille de tuiles (tableau 2D)', type: 'array', isArray: true, example: [[{ type: 'base' }, { type: 'wall' }]] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TileDto)
    tiles: TileDto[][];

    @ApiProperty({ description: 'Objets de la carte', type: MapObjectsDto })
    @ValidateNested()
    @Type(() => MapObjectsDto)
    @IsNotEmpty()
    objects: MapObjectsDto;

    @ApiProperty({ description: 'Image de prévisualisation', required: false })
    @IsOptional()
    @IsString()
    previewImage?: string;
}

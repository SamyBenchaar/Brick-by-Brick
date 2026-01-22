import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MapConfigDto } from './map-config.dto';
import { MapObjectsDto } from './map-objects.dto';
import { TileDto } from './tile.dto';

export class CreateGameDto {
    @ApiProperty({ description: 'Nom du jeu', example: 'Mon Premier Jeu' })
    @IsString({ message: 'Le nom doit être une chaîne de caractères' })
    @IsNotEmpty({ message: 'Le nom ne peut pas être vide' })
    name: string;

    @ApiProperty({ description: 'Description du jeu', example: 'Un jeu de test' })
    @IsString({ message: 'La description doit être une chaîne de caractères' })
    @IsNotEmpty({ message: 'La description ne peut pas être vide' })
    description: string;

    @ApiProperty({ description: 'Visibilité du jeu', example: false })
    @IsBoolean({ message: 'La visibilité doit être un booléen' })
    isVisible: boolean;

    @ApiProperty({ description: 'Configuration de la carte', type: MapConfigDto })
    @ValidateNested({ message: 'La configuration de la carte est invalide' })
    @Type(() => MapConfigDto)
    @IsNotEmpty({ message: 'La configuration de la carte ne peut pas être vide' })
    mapConfig: MapConfigDto;

    @ApiProperty({ description: 'Grille de tuiles (tableau 2D)', type: 'array', isArray: true, example: [[{ type: 'base' }, { type: 'wall' }]] })
    @IsArray({ message: 'Les tuiles doivent être un tableau' })
    @ValidateNested({ each: true, message: 'Les tuiles sont invalides' })
    @Type(() => TileDto)
    tiles: TileDto[][];

    @ApiProperty({ description: 'Objets de la carte', type: MapObjectsDto })
    @ValidateNested({ message: 'Les objets de la carte sont invalides' })
    @Type(() => MapObjectsDto)
    @IsNotEmpty({ message: 'Les objets de la carte ne peuvent pas être vides' })
    objects: MapObjectsDto;

    @ApiProperty({ description: 'Image de prévisualisation', required: false })
    @IsOptional()
    @IsString({ message: "L'image de prévisualisation doit être une chaîne de caractères" })
    previewImage?: string;
}

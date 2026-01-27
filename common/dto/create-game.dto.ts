import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { MapConfigDto } from './map-config.dto';

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

    @ApiProperty({ description: 'Nombre de joueurs', example: 2, minimum: 2 })
    @IsNumber({}, { message: 'Le nombre de joueurs doit être un nombre' })
    @Min(2, { message: 'Le nombre de joueurs doit être au minimum 2' })
    numberOfPlayers: number;

    @ApiProperty({ description: 'Mode de jeu', enum: ['classic', 'ctf'], example: 'classic' })
    @IsEnum(['classic', 'ctf'], { message: 'Le mode de jeu doit être classic ou ctf' })
    gameMode: string;

    @ApiProperty({ description: 'Configuration de la carte', type: MapConfigDto })
    @ValidateNested({ message: 'La configuration de la carte est invalide' })
    @Type(() => MapConfigDto)
    @IsNotEmpty({ message: 'La configuration de la carte ne peut pas être vide' })
    mapConfig: MapConfigDto;

    @ApiProperty({ description: 'Image de prévisualisation', required: false })
    @IsOptional()
    @IsString({ message: "L'image de prévisualisation doit être une chaîne de caractères" })
    previewImage?: string;
}

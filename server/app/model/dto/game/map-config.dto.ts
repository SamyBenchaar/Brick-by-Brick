import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { GridSizeDto } from './grid-size.dto';

export class MapConfigDto {
    @ApiProperty({ description: 'Taille de la carte', enum: ['small', 'medium', 'large'], example: 'medium' })
    @IsEnum(['small', 'medium', 'large'])
    size: string;

    @ApiProperty({ description: 'Dimensions de la grille', type: GridSizeDto })
    @ValidateNested()
    @Type(() => GridSizeDto)
    @IsNotEmpty()
    gridSize: GridSizeDto;

    @ApiProperty({ description: 'Mode de jeu', enum: ['classic', 'ctf'], example: 'classic' })
    @IsEnum(['classic', 'ctf'])
    gameMode: string;
}

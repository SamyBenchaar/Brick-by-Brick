import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, ValidateNested } from 'class-validator';
import { GridSizeDto } from './grid-size.dto';

export class MapConfigDto {
    @ApiProperty({ description: 'Taille de la carte', enum: ['small', 'medium', 'large'], example: 'medium' })
    @IsEnum(['small', 'medium', 'large'], { message: 'La taille doit être small, medium ou large' })
    size: string;

    @ApiProperty({ description: 'Dimensions de la grille', type: GridSizeDto })
    @ValidateNested({ message: 'Les dimensions de la grille sont invalides' })
    @Type(() => GridSizeDto)
    @IsNotEmpty({ message: 'Les dimensions de la grille ne peuvent pas être vides' })
    gridSize: GridSizeDto;

    @ApiProperty({ description: 'Mode de jeu', enum: ['classic', 'ctf'], example: 'classic' })
    @IsEnum(['classic', 'ctf'], { message: 'Le mode de jeu doit être classic ou ctf' })
    gameMode: string;
}

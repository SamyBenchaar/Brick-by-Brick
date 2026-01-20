import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class GridSizeDto {
    @ApiProperty({ description: 'Largeur de la grille', example: 15 })
    @IsInt()
    @IsPositive()
    width: number;

    @ApiProperty({ description: 'Hauteur de la grille', example: 15 })
    @IsInt()
    @IsPositive()
    height: number;
}

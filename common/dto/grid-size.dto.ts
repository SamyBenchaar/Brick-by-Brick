import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class GridSizeDto {
    @ApiProperty({ description: 'Largeur de la grille', example: 15 })
    @IsInt({ message: 'La largeur doit être un nombre entier' })
    @IsPositive({ message: 'La largeur doit être positive' })
    width: number;

    @ApiProperty({ description: 'Hauteur de la grille', example: 15 })
    @IsInt({ message: 'La hauteur doit être un nombre entier' })
    @IsPositive({ message: 'La hauteur doit être positive' })
    height: number;
}

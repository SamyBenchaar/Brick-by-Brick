import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { TileDto } from './tile.dto';

export class MapConfigDto {
    @ApiProperty({ description: 'Taille de la carte', enum: ['Small', 'Medium', 'Large'], example: 'Medium' })
    @IsEnum(['Small', 'Medium', 'Large'], { message: 'La taille doit être Small, Medium ou Large' })
    size: string;

    @ApiProperty({description: 'Grille de tuiles (matrice 2D)', type: [TileDto],isArray: true})
    @IsArray({ message: 'Les tuiles doivent être un tableau' })
    @ValidateNested({ each: true })
    @Type(() => TileDto)
    tiles: TileDto[][];
}

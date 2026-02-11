import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { MapObjectsDto } from './map-objects.dto';

export class TileDto {
    @ApiProperty({ description: 'Type de tuile', enum: ['base', 'wall', 'door', 'water', 'ice'], example: 'base' })
    @IsEnum(['base', 'wall', 'door', 'water', 'ice'], { message: 'Le type de tuile doit être base, wall, door, water ou ice' })
    type: string;

    @ApiProperty({ description: 'Objet présent sur cette tuile', type: MapObjectsDto, required: false })
    @IsOptional()
    @ValidateNested({ message: "L'objet de la tuile est invalide" })
    @Type(() => MapObjectsDto)
    object?: MapObjectsDto;
}

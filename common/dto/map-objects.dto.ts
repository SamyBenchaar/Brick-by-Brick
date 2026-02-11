import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class MapObjectsDto {
    @ApiProperty({ description: 'Type d\'objet', enum: ['startingpoint']})
    @IsEnum(['startingpoint'], { message: 'Le type doit être startingpoint' })
    type: string;
}

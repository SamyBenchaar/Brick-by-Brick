import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class MapObjectsDto {
    @ApiProperty({ description: 'Type d\'objet', enum: ['startingpoint']})
    @IsEnum(['startingpoint'], { message: 'Le type doit être startingpoint' })
    type: string;
}

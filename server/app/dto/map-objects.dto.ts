import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class MapObjectsDto {
    @ApiProperty({ description: 'Type d\'objet', enum: ['startingpoint', 'healingsanctuary', 'combatsanctuary', 'flag'] })
    @IsEnum(['startingpoint', 'healingsanctuary', 'combatsanctuary', 'flag'],
        { message: 'Le type doit être startingpoint, healingsanctuary, combatsanctuary ou flag' })
    type: string;
}

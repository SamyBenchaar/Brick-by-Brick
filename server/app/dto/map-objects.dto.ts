import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class MapObjectsDto {
    @ApiProperty({ description: 'Type d\'objet', enum: ['startingpoint', 'healingsanctuary', 'combatsanctuary']})
    @IsEnum(['startingpoint', 'healingsanctuary', 'combatsanctuary'],
         { message: 'Le type doit être startingpoint, healingsanctuary ou combatsanctuary' })
    type: string;
}

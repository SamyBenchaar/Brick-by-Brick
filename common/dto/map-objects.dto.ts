import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class MapObjectsDto {
    @ApiProperty({ description: 'Présence d\'un drapeau sur cette tuile', example: false, required: false })
    @IsOptional()
    @IsBoolean({ message: 'Le drapeau doit être un booléen' })
    flag?: boolean;

    @ApiProperty({ description: 'Type d\'objet', enum: ['startingPoints', 'healSanctuaries', 'combatSanctuaries'], example: 'startingPoints' })
    @IsEnum(['startingPoints', 'healSanctuaries', 'combatSanctuaries'], { message: 'Le type doit être startingPoints, healSanctuaries ou combatSanctuaries' })
    type: string;
}

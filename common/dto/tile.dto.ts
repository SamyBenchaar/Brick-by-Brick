import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class TileDto {
    @ApiProperty({ description: 'Type de tuile', enum: ['base', 'wall', 'door', 'water', 'ice'], example: 'base' })
    @IsEnum(['base', 'wall', 'door', 'water', 'ice'], { message: 'Le type de tuile doit être base, wall, door, water ou ice' })
    type: string;

    @ApiProperty({ description: 'État de la tuile', enum: ['open', 'closed'], required: false, example: 'open' })
    @IsOptional()
    @IsEnum(['open', 'closed'], { message: "L'état de la tuile doit être open ou closed" })
    state?: string;
}

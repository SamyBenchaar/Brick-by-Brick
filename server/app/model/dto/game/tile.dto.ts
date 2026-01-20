import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class TileDto {
    @ApiProperty({ description: 'Type de tuile', enum: ['base', 'wall', 'door', 'water', 'ice'], example: 'base' })
    @IsEnum(['base', 'wall', 'door', 'water', 'ice'])
    type: string;

    @ApiProperty({ description: 'État de la tuile', enum: ['open', 'closed'], required: false, example: 'open' })
    @IsOptional()
    @IsEnum(['open', 'closed'])
    state?: string;
}

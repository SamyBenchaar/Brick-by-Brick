import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class PositionDto {
    @ApiProperty({ description: 'Position X', example: 0 })
    @IsInt({ message: 'La position X doit être un nombre entier' })
    @Min(0, { message: 'La position X doit être supérieure ou égale à 0' })
    x: number;

    @ApiProperty({ description: 'Position Y', example: 0 })
    @IsInt({ message: 'La position Y doit être un nombre entier' })
    @Min(0, { message: 'La position Y doit être supérieure ou égale à 0' })
    y: number;
}

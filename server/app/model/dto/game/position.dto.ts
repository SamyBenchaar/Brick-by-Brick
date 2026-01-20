import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class PositionDto {
    @ApiProperty({ description: 'Position X', example: 0 })
    @IsInt()
    @Min(0)
    x: number;

    @ApiProperty({ description: 'Position Y', example: 0 })
    @IsInt()
    @Min(0)
    y: number;
}

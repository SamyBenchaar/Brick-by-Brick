import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { PositionDto } from './position.dto';

export class MapObjectsDto {
    @ApiProperty({ description: 'Points de départ', type: [PositionDto], example: [{ x: 0, y: 0 }] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PositionDto)
    startingPoints: PositionDto[];

    @ApiProperty({ description: 'Position du drapeau (mode CTF)', type: PositionDto, required: false })
    @IsOptional()
    @ValidateNested()
    @Type(() => PositionDto)
    flag?: PositionDto;

    @ApiProperty({ description: 'Sanctuaires de soin', type: [PositionDto], example: [] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PositionDto)
    healSanctuaries: PositionDto[];

    @ApiProperty({ description: 'Sanctuaires de combat', type: [PositionDto], example: [] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PositionDto)
    combatSanctuaries: PositionDto[];
}

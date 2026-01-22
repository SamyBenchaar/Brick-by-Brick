import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { PositionDto } from './position.dto';

export class MapObjectsDto {
    @ApiProperty({ description: 'Points de départ', type: [PositionDto], example: [{ x: 0, y: 0 }] })
    @IsArray({ message: 'Les points de départ doivent être un tableau' })
    @ValidateNested({ each: true, message: 'Les points de départ sont invalides' })
    @Type(() => PositionDto)
    startingPoints: PositionDto[];

    @ApiProperty({ description: 'Position du drapeau (mode CTF)', type: PositionDto, required: false })
    @IsOptional()
    @ValidateNested({ message: 'La position du drapeau est invalide' })
    @Type(() => PositionDto)
    flag?: PositionDto;

    @ApiProperty({ description: 'Sanctuaires de soin', type: [PositionDto], example: [] })
    @IsArray({ message: 'Les sanctuaires de soin doivent être un tableau' })
    @ValidateNested({ each: true, message: 'Les sanctuaires de soin sont invalides' })
    @Type(() => PositionDto)
    healSanctuaries: PositionDto[];

    @ApiProperty({ description: 'Sanctuaires de combat', type: [PositionDto], example: [] })
    @IsArray({ message: 'Les sanctuaires de combat doivent être un tableau' })
    @ValidateNested({ each: true, message: 'Les sanctuaires de combat sont invalides' })
    @Type(() => PositionDto)
    combatSanctuaries: PositionDto[];
}

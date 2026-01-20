import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { GridSize } from './grid-size';

@Schema({ _id: false })
export class MapConfig {
    @ApiProperty()
    @Prop({ required: true, enum: ['small', 'medium', 'large'] })
    size: string;

    @ApiProperty()
    @Prop({ required: true, type: GridSize })
    gridSize: GridSize;

    @ApiProperty()
    @Prop({ required: true, enum: ['classic', 'ctf'] })
    gameMode: string;
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { GridSize, gridSizeSchema } from './grid-size';

@Schema({ _id: false })
export class MapConfig {
    @ApiProperty()
    @Prop({ required: true, enum: ['small', 'medium', 'large'] })
    size: string;

    @ApiProperty()
    @Prop({ required: true, type: gridSizeSchema })
    gridSize: GridSize;

    @ApiProperty()
    @Prop({ required: true, enum: ['classic', 'ctf'] })
    gameMode: string;
}

export const mapConfigSchema = SchemaFactory.createForClass(MapConfig);

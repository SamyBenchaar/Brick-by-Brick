import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Tile, tileSchema } from './tile';


@Schema({ _id: false })
export class MapConfig {
    @ApiProperty()
    @Prop({ required: true, enum: ['Small', 'Medium', 'Large'] })
    size: string;

    @ApiProperty()
    @Prop({ required: true, type: [[tileSchema]] })
    tiles: Tile[][];

}

export const mapConfigSchema = SchemaFactory.createForClass(MapConfig);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { MapObjects, mapObjectsSchema } from './map-objects';

@Schema({ _id: false })
export class Tile {
    @ApiProperty()
    @Prop({ required: true, enum: ['base', 'wall', 'door', 'water', 'ice'] })
    type: string;

    @ApiProperty()
    @Prop({ required: false, enum: ['open', 'closed'] })
    state?: string;

    @ApiProperty()
    @Prop({ required: false, type: mapObjectsSchema })
    objects?: MapObjects;
}

export const tileSchema = SchemaFactory.createForClass(Tile);

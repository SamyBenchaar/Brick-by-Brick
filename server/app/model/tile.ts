import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { MapObject, mapObjectSchema } from './map-objects';

@Schema({ _id: false })
export class Tile {
    @ApiProperty()
    @Prop({ required: true, enum: ['base', 'wall', 'door', 'water', 'ice'] })
    type: string;


    @ApiProperty()
    @Prop({ required: false, type: mapObjectSchema })
    object?: MapObject;

    @ApiProperty()
    @Prop({ required: false, enum: ['opened', 'closed'] })
    doorState?: string;

}

export const tileSchema = SchemaFactory.createForClass(Tile);

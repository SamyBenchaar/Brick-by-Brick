import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';
import { MapConfig, MapConfigSchema } from './map-config';
import { MapObjects, MapObjectsSchema } from './map-objects';
import { Tile, TileSchema } from './tile';

export type GameDocument = Game & Document;

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: 'lastModified' } })
export class Game {
    @ApiProperty()
    @Prop({ required: true, unique: true })
    name: string;

    @ApiProperty()
    @Prop({ required: true })
    description: string;

    @ApiProperty()
    @Prop({ required: true, default: false })
    isVisible: boolean;

    @ApiProperty()
    @Prop({ required: true, type: MapConfigSchema })
    mapConfig: MapConfig;

    @ApiProperty()
    @Prop({ required: true, type: [[TileSchema]] })
    tiles: Tile[][];

    @ApiProperty()
    @Prop({ required: true, type: MapObjectsSchema })
    objects: MapObjects;

    @ApiProperty()
    @Prop({ required: false })
    previewImage?: string;

    @ApiProperty()
    createdAt?: Date;

    @ApiProperty()
    lastModified?: Date;

    @ApiProperty()
    _id?: string;
}

export const gameSchema = SchemaFactory.createForClass(Game);

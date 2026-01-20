import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';
import { MapConfig } from './map-config';
import { MapObjects } from './map-objects';
import { Tile } from './tile';

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
    @Prop({ required: true, type: MapConfig })
    mapConfig: MapConfig;

    @ApiProperty()
    @Prop({ required: true, type: [[Tile]] })
    tiles: Tile[][];

    @ApiProperty()
    @Prop({ required: true, type: MapObjects })
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

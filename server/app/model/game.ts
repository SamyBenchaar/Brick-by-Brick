import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';
import { MapConfig, mapConfigSchema } from './map-config';

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
    @Prop({ required: true, default: true })
    isVisible: boolean;

    @ApiProperty()
    @Prop({ required: true, min: 2 })
    numberOfPlayers: number;

    @ApiProperty()
    @Prop({ required: true, enum: ['classic', 'ctf'] })
    gameMode: string;

    @ApiProperty()
    @Prop({ required: true, type: mapConfigSchema })
    mapConfig: MapConfig;

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

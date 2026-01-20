import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';

export type GameDocument = Game & Document;

// Sous-schéma pour la taille de la grille
@Schema({ _id: false })
export class GridSize {
    @ApiProperty()
    @Prop({ required: true })
    width: number;

    @ApiProperty()
    @Prop({ required: true })
    height: number;
}

// Sous-schéma pour la configuration de la carte
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

// Sous-schéma pour une tuile
@Schema({ _id: false })
export class Tile {
    @ApiProperty()
    @Prop({ required: true, enum: ['base', 'wall', 'door', 'water', 'ice'] })
    type: string;

    @ApiProperty()
    @Prop({ required: false, enum: ['open', 'closed'] })
    state: string;
}

// Sous-schéma pour une position (x, y)
@Schema({ _id: false })
export class Position {
    @ApiProperty()
    @Prop({ required: true })
    x: number;

    @ApiProperty()
    @Prop({ required: true })
    y: number;
}

// Sous-schéma pour les objets de la carte
@Schema({ _id: false })
export class MapObjects {
    @ApiProperty()
    @Prop({ required: true, type: [Position] })
    startingPoints: Position[];

    @ApiProperty()
    @Prop({ required: false, type: Position })
    flag?: Position;

    @ApiProperty()
    @Prop({ required: true, type: [Position] })
    healSanctuaries: Position[];

    @ApiProperty()
    @Prop({ required: true, type: [Position] })
    combatSanctuaries: Position[];
}

// Schéma principal du jeu
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

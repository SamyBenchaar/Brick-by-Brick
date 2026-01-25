import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Position, positionSchema } from './position';

@Schema({ _id: false })
export class MapObjects {
    @ApiProperty()
    @Prop({ required: true, type: [positionSchema] })
    startingPoints: Position[];

    @ApiProperty()
    @Prop({ required: false, type: positionSchema })
    flag?: Position;

    @ApiProperty()
    @Prop({ required: true, type: [positionSchema] })
    healSanctuaries: Position[];

    @ApiProperty()
    @Prop({ required: true, type: [positionSchema] })
    combatSanctuaries: Position[];
}

export const mapObjectsSchema = SchemaFactory.createForClass(MapObjects);

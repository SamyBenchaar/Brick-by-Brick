import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Position, PositionSchema } from './position';

@Schema({ _id: false })
export class MapObjects {
    @ApiProperty()
    @Prop({ required: true, type: [PositionSchema] })
    startingPoints: Position[];

    @ApiProperty()
    @Prop({ required: false, type: PositionSchema })
    flag?: Position;

    @ApiProperty()
    @Prop({ required: true, type: [PositionSchema] })
    healSanctuaries: Position[];

    @ApiProperty()
    @Prop({ required: true, type: [PositionSchema] })
    combatSanctuaries: Position[];
}

export const MapObjectsSchema = SchemaFactory.createForClass(MapObjects);

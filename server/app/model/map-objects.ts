import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class MapObjects {
    @ApiProperty()
    @Prop({ required: false })
    flag?: boolean;

    @ApiProperty()
    @Prop({ required: true, enum: ['startingPoints', 'healSanctuaries', 'combatSanctuaries'] })
    type: string;
}

export const mapObjectsSchema = SchemaFactory.createForClass(MapObjects);

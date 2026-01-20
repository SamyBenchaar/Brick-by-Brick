import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class Position {
    @ApiProperty()
    @Prop({ required: true })
    x: number;

    @ApiProperty()
    @Prop({ required: true })
    y: number;
}

export const PositionSchema = SchemaFactory.createForClass(Position);

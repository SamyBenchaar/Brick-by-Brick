import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class GridSize {
    @ApiProperty()
    @Prop({ required: true })
    width: number;

    @ApiProperty()
    @Prop({ required: true })
    height: number;
}

export const gridSizeSchema = SchemaFactory.createForClass(GridSize);

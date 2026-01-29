import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class MapObject {
    @ApiProperty()
    @Prop({ required: false })
    flag?: boolean;

    @ApiProperty()
    @Prop({ required: true, enum: ['flag', 'startingpoint', 'healingsanctuary', 'combatsanctuary'] })
    type: string;
}

export const mapObjectSchema = SchemaFactory.createForClass(MapObject);

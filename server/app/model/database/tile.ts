import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema({ _id: false })
export class Tile {
    @ApiProperty()
    @Prop({ required: true, enum: ['base', 'wall', 'door', 'water', 'ice'] })
    type: string;

    @ApiProperty()
    @Prop({ required: false, enum: ['open', 'closed'] })
    state?: string;
}

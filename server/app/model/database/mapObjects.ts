import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Position } from './position';

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

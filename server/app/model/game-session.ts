import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

@Schema()
export class GameSession {
    @ApiProperty()
    @Prop({ required: true })
    gameId: string;

    @ApiProperty()
    @Prop({ required: true, default: [] })
    players: string[];
}

export const gameSessionSchema = SchemaFactory.createForClass(GameSession);
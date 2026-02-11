import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGameSessionDto {
    @ApiProperty({ description: 'Identifiant du jeu', example: '697b866e802124cfdcaa01b4' })
    @IsString({ message: 'L\'identifiant doit être une chaîne de caractères' })
    @IsNotEmpty({ message: 'L\'identifiant ne peut pas être vide' })
    gameId: string;
}

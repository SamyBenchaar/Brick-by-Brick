import { Injectable } from '@angular/core';
import { GameSession } from '@app/interfaces/game-session';
import { Character } from '@common/character';
import { Player } from '@common/player';

@Injectable({
    providedIn: 'root',
})
export class PlayerSessionQueryService {
    getCharacterById(session: GameSession | null, characterId: string): Character | null {
        if (!session) {
            return null;
        }

        return session.players.find((player: Player) => player.character.id === characterId)?.character ?? null;
    }

    getCurrentPlayerCharacter(session: GameSession | null, socketId: string): Character | null {
        if (!session) {
            return null;
        }

        return session.players.find((player: Player) => player.socketId === socketId)?.character ?? null;
    }
}

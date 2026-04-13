import { GameSession, Position } from '@app/domain/game-session';
import { CombatInfo, CombatResult, GameMap } from '@app/interfaces/game-map-interfaces';
import { Character } from '@common/character';
import { VICTORIES_TO_WIN } from '@common/constants/game-config-constants';
import { Injectable, Logger } from '@nestjs/common';
import { StartingPointService } from './starting-point.service';


@Injectable()
export class CombatService {
    private logger = new Logger(CombatService.name);
    private readonly victoriesToWin = VICTORIES_TO_WIN;

    checkGameWinCondition(players: Character[]): Character | null {
        for (const player of players) {
            if (player.victories >= this.victoriesToWin) {
                return player;
            }
        }
        return null;
    }

}

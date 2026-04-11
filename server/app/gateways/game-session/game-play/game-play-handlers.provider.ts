import { GamePlayCombatHandler } from '@app/gateways/game-session/game-play/game-play-combat.handler';
import { GamePlayCtfHandler } from '@app/gateways/game-session/game-play/game-play-ctf.handler';
import { GamePlayMovementHandler } from '@app/gateways/game-session/game-play/game-play-movement.handler';
import { GamePlayTurnHandler } from '@app/gateways/game-session/game-play/game-play-turn.handler';
import { GamePlaySanctuaryHandler } from '@app/gateways/game-session/game-play/game-play-sanctuary.handler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GamePlayHandlersProvider {
    constructor(
        readonly combatHandler: GamePlayCombatHandler,
        readonly movementHandler: GamePlayMovementHandler,
        readonly ctfHandler: GamePlayCtfHandler,
        readonly turnHandler: GamePlayTurnHandler,
        readonly sanctuaryHandler: GamePlaySanctuaryHandler,
    ) {}
}

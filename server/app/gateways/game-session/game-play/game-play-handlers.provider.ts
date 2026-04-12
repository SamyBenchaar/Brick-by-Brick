import { GamePlayCombatHandler } from '@app/gateways/game-session/game-play/game-play-combat.handler';
import { GamePlayCtfHandler } from '@app/gateways/game-session/game-play/game-play-ctf.handler';
import { GamePlayMovementHandler } from '@app/gateways/game-session/game-play/game-play-movement.handler';
import { GamePlayTurnHandler } from '@app/gateways/game-session/game-play/game-play-turn.handler';
import { GamePlaySanctuaryHandler } from '@app/gateways/game-session/game-play/game-play-sanctuary.handler';
import { Inject, Injectable } from '@nestjs/common';
import { GamePlayAbandonHandler } from './game-playa-abandon.handler';

@Injectable()
export class GamePlayHandlersProvider {
    @Inject(GamePlayCombatHandler)
    readonly combatHandler: GamePlayCombatHandler;
    @Inject(GamePlayMovementHandler)
    readonly movementHandler: GamePlayMovementHandler;
    @Inject(GamePlayCtfHandler)
    readonly ctfHandler: GamePlayCtfHandler;
    @Inject(GamePlayTurnHandler)
    readonly turnHandler: GamePlayTurnHandler;
    @Inject(GamePlaySanctuaryHandler)
    readonly sanctuaryHandler: GamePlaySanctuaryHandler;
    @Inject(GamePlayAbandonHandler)
    readonly abandonHandler: GamePlayAbandonHandler;
}

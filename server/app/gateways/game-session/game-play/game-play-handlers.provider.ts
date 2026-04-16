import { GamePlayAbandonHandler } from '@app/gateways/game-session/game-play/game-play-abandon.handler';
import { GamePlayCombatHandler } from '@app/gateways/game-session/game-play/game-play-combat.handler';
import { GamePlayCtfHandler } from '@app/gateways/game-session/game-play/game-play-ctf.handler';
import { GamePlayMovementHandler } from '@app/gateways/game-session/game-play/game-play-movement.handler';
import { GamePlaySanctuaryHandler } from '@app/gateways/game-session/game-play/game-play-sanctuary.handler';
import { GamePlayTurnHandler } from '@app/gateways/game-session/game-play/game-play-turn.handler';
import { Inject, Injectable, forwardRef } from '@nestjs/common';

@Injectable()
export class GamePlayHandlersProvider {
    @Inject(forwardRef(() => GamePlayCombatHandler))
    readonly combatHandler: GamePlayCombatHandler;
    @Inject(forwardRef(() => GamePlayMovementHandler))
    readonly movementHandler: GamePlayMovementHandler;
    @Inject(forwardRef(() => GamePlayCtfHandler))
    readonly ctfHandler: GamePlayCtfHandler;
    @Inject(forwardRef(() => GamePlayTurnHandler))
    readonly turnHandler: GamePlayTurnHandler;
    @Inject(forwardRef(() => GamePlaySanctuaryHandler))
    readonly sanctuaryHandler: GamePlaySanctuaryHandler;
    @Inject(forwardRef(() => GamePlayAbandonHandler))
    readonly abandonHandler: GamePlayAbandonHandler;
}

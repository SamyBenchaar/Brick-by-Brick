import { VirtualPlayerStepOutcome } from '@app/constants/virtual-player.constants';
import { GameSession } from '@app/domain/game-session';
import { GameModeValue } from '@common/constants/game-config-constants';
import { Player } from '@common/player';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerMechanicsService } from './virtual-player-mechanics.service';

@Injectable()
export class VirtualPlayerCtfService {
    @Inject() private readonly mechanics: VirtualPlayerMechanicsService;

    async handleStep(session: GameSession, bot: Player, profile: VirtualPlayerProfile): Promise<VirtualPlayerStepOutcome> {
        if (session.gameMode !== GameModeValue.Ctf) {
            return VirtualPlayerStepOutcome.None;
        }

        if (this.mechanics.hasFlag(bot)) {
            return this.returnToBase(session, bot);
        }

        const enemyFlagHolder = this.mechanics.findEnemyFlagHolder(session, bot);
        if (enemyFlagHolder) {
            if (profile === VirtualPlayerProfile.Aggressive) {
                return this.aggressiveAgainstFlagHolder(session, bot, enemyFlagHolder);
            }
            if (profile === VirtualPlayerProfile.Defensive) {
                return this.defensiveAgainstFlagHolder(session, bot, enemyFlagHolder);
            }
        }

        return this.tryCaptureFlag(session, bot);
    }

    private async returnToBase(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        const ownStart = this.mechanics.getOwnStartingPoint(session, bot);
        if (!ownStart) {
            return VirtualPlayerStepOutcome.Stop;
        }

        const movedToBase = await this.mechanics.moveTowardPosition(session, bot, ownStart);
        return movedToBase ? VirtualPlayerStepOutcome.Continue : VirtualPlayerStepOutcome.Stop;
    }

    private async aggressiveAgainstFlagHolder(
        session: GameSession,
        bot: Player,
        enemyFlagHolder: Player,
    ): Promise<VirtualPlayerStepOutcome> {
        const attackedFlagHolder = await this.mechanics.tryAttackSpecificAdjacent(session, bot, enemyFlagHolder);
        if (attackedFlagHolder) {
            return VirtualPlayerStepOutcome.Continue;
        }

        const usedSanctuary = await this.mechanics.tryUseAdjacentSanctuary(session, bot);
        if (usedSanctuary) {
            return VirtualPlayerStepOutcome.Continue;
        }

        if (!this.mechanics.canMove(bot)) {
            return VirtualPlayerStepOutcome.Stop;
        }

        const movedTowardFlagHolder = await this.mechanics.moveTowardEnemy(session, bot, enemyFlagHolder);
        return movedTowardFlagHolder ? VirtualPlayerStepOutcome.Continue : VirtualPlayerStepOutcome.Stop;
    }

    private async defensiveAgainstFlagHolder(
        session: GameSession,
        bot: Player,
        enemyFlagHolder: Player,
    ): Promise<VirtualPlayerStepOutcome> {
        const holderStart = this.mechanics.getOwnStartingPoint(session, enemyFlagHolder);
        const interceptionTarget = holderStart
            ? this.mechanics.findNearestWalkableTile(session, bot, holderStart)
            : null;


        if (
            interceptionTarget &&
            bot.character.position &&
            this.mechanics.samePosition(interceptionTarget, bot.character.position)
        ) {
            return VirtualPlayerStepOutcome.Stop;
        }

        if (
            interceptionTarget &&
            bot.character.position &&
            !this.mechanics.samePosition(interceptionTarget, bot.character.position) &&
            this.mechanics.canMove(bot)
        ) {
            const movedToIntercept = await this.mechanics.moveTowardPosition(session, bot, interceptionTarget);
            if (movedToIntercept) {
                return VirtualPlayerStepOutcome.Stop;
            }
        }

        const attackedHolder = await this.mechanics.tryAttackSpecificAdjacent(session, bot, enemyFlagHolder);
        if (attackedHolder) {
            return VirtualPlayerStepOutcome.Continue;
        }

        const usedSanctuary = await this.mechanics.tryUseAdjacentSanctuary(session, bot);
        if (usedSanctuary) {
            return VirtualPlayerStepOutcome.Continue;
        }

        return VirtualPlayerStepOutcome.None;
    }

    private async tryCaptureFlag(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        if (!this.mechanics.canMove(bot)) {
            return VirtualPlayerStepOutcome.None;
        }

        const flagPosition = this.mechanics.getFlagPosition(session);
        if (!flagPosition) {
            return VirtualPlayerStepOutcome.None;
        }

        const movedTowardFlag = await this.mechanics.moveTowardPosition(session, bot, flagPosition);
        return movedTowardFlag ? VirtualPlayerStepOutcome.Continue : VirtualPlayerStepOutcome.None;
    }
}

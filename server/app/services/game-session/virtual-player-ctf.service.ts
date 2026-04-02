import { GameSession } from '@app/domain/game-session';
import { Player } from '@common/player';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerMechanicsService } from './virtual-player-mechanics.service';

export type VirtualPlayerStepOutcome = 'continue' | 'stop' | 'none';

@Injectable()
export class VirtualPlayerCtfService {
    @Inject() private readonly mechanics: VirtualPlayerMechanicsService;

    async handleStep(session: GameSession, bot: Player, profile: VirtualPlayerProfile): Promise<VirtualPlayerStepOutcome> {
        if (session.gameMode !== 'ctf') {
            return 'none';
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
            return 'stop';
        }

        const movedToBase = await this.mechanics.moveTowardPosition(session, bot, ownStart);
        return movedToBase ? 'continue' : 'stop';
    }

    private async aggressiveAgainstFlagHolder(
        session: GameSession,
        bot: Player,
        enemyFlagHolder: Player,
    ): Promise<VirtualPlayerStepOutcome> {
        const attackedFlagHolder = await this.mechanics.tryAttackSpecificAdjacent(session, bot, enemyFlagHolder);
        if (attackedFlagHolder) {
            return 'continue';
        }

        if (!this.mechanics.canMove(bot)) {
            return 'stop';
        }

        const movedTowardFlagHolder = await this.mechanics.moveTowardEnemy(session, bot, enemyFlagHolder);
        return movedTowardFlagHolder ? 'continue' : 'stop';
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
            return 'stop';
        }

        if (
            interceptionTarget &&
            bot.character.position &&
            !this.mechanics.samePosition(interceptionTarget, bot.character.position) &&
            this.mechanics.canMove(bot)
        ) {
            const movedToIntercept = await this.mechanics.moveTowardPosition(session, bot, interceptionTarget);
            if (movedToIntercept) {
                return 'stop';
            }
        }

        const attackedHolder = await this.mechanics.tryAttackSpecificAdjacent(session, bot, enemyFlagHolder);
        if (attackedHolder) {
            return 'continue';
        }

        return 'none';
    }

    private async tryCaptureFlag(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        if (!this.mechanics.canMove(bot)) {
            return 'none';
        }

        const flagPosition = this.mechanics.getFlagPosition(session);
        if (!flagPosition) {
            return 'none';
        }

        const movedTowardFlag = await this.mechanics.moveTowardPosition(session, bot, flagPosition);
        return movedTowardFlag ? 'continue' : 'none';
    }
}

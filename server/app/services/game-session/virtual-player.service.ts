import { GameSession } from '@app/domain/game-session';
import { Player } from '@common/player';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerMechanicsService } from './virtual-player-mechanics.service';

@Injectable()
export class VirtualPlayerService {
    @Inject() private readonly virtualPlayerMechanicsService: VirtualPlayerMechanicsService;

    async playTurn(session: GameSession, bot: Player): Promise<void> {
        if (!session.getMapCopy()?.tiles || !bot.character.position) {
            return;
        }

        if (bot.virtualProfile === VirtualPlayerProfile.Aggressive) {
            await this.aggressiveBehavior(session, bot);
        } else if (bot.virtualProfile === VirtualPlayerProfile.Defensive) {
            await this.defensiveBehavior(session, bot);
        }
    }

    private async aggressiveBehavior(session: GameSession, bot: Player): Promise<void> {
        while (this.virtualPlayerMechanicsService.canContinueTurn(bot)) {
            const attacked = await this.virtualPlayerMechanicsService.tryAttackAdjacent(session, bot);
            if (attacked) {
                return;
            }

            if (!this.virtualPlayerMechanicsService.canMove(bot)) {
                return;
            }

            const nearestEnemy = this.virtualPlayerMechanicsService.findNearestEnemy(session, bot);
            if (!nearestEnemy?.character.position) {
                return;
            }

            const moved = await this.virtualPlayerMechanicsService.moveTowardEnemy(session, bot, nearestEnemy);
            if (!moved) {
                return;
            }
        }
    }

    private async defensiveBehavior(session: GameSession, bot: Player): Promise<void> {
        while (this.virtualPlayerMechanicsService.canContinueTurn(bot)) {
            if (this.virtualPlayerMechanicsService.canMove(bot)) {
                const nearestEnemy = this.virtualPlayerMechanicsService.findNearestEnemy(session, bot);
                if (nearestEnemy?.character.position) {
                    const fleeTarget = this.virtualPlayerMechanicsService.findFleeTarget(session, bot, nearestEnemy);
                    if (fleeTarget && !this.virtualPlayerMechanicsService.samePosition(fleeTarget, bot.character.position)) {
                        const moved = await this.virtualPlayerMechanicsService.moveTowardPosition(session, bot, fleeTarget);
                        if (moved) {
                            continue;
                        }
                    }
                }
            }

            const attacked = await this.virtualPlayerMechanicsService.tryAttackAdjacent(session, bot);
            if (attacked) {
                return;
            }

            return;
        }
    }

}


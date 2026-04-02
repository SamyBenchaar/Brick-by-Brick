import { GameSession } from '@app/domain/game-session';
import { Player } from '@common/player';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerCtfService, VirtualPlayerStepOutcome } from './virtual-player-ctf.service';
import { VirtualPlayerMechanicsService } from './virtual-player-mechanics.service';

@Injectable()
export class VirtualPlayerService {
    @Inject() private readonly virtualPlayerMechanicsService: VirtualPlayerMechanicsService;
    @Inject() private readonly virtualPlayerCtfService: VirtualPlayerCtfService;

    async playTurn(session: GameSession, bot: Player): Promise<void> {
        if (!session.getMapCopy()?.tiles || !bot.character.position) {
            return;
        }

        if (!bot.virtualProfile) {
            return;
        }

        while (this.virtualPlayerMechanicsService.canContinueTurn(bot)) {
            const ctfOutcome = await this.virtualPlayerCtfService.handleStep(session, bot, bot.virtualProfile);
            if (ctfOutcome === 'continue') {
                continue;
            }
            if (ctfOutcome === 'stop') {
                return;
            }

            const classicOutcome = bot.virtualProfile === VirtualPlayerProfile.Aggressive
                ? await this.aggressiveStep(session, bot)
                : await this.defensiveStep(session, bot);

            if (classicOutcome === 'continue') {
                continue;
            }

            return;
        }
    }

    private async aggressiveStep(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        const attacked = await this.virtualPlayerMechanicsService.tryAttackAdjacent(session, bot);
        if (attacked) {
            return 'stop';
        }

        if (!this.virtualPlayerMechanicsService.canMove(bot)) {
            return 'stop';
        }

        const nearestEnemy = this.virtualPlayerMechanicsService.findNearestEnemy(session, bot);
        if (!nearestEnemy?.character.position) {
            return 'stop';
        }

        const moved = await this.virtualPlayerMechanicsService.moveTowardEnemy(session, bot, nearestEnemy);
        return moved ? 'continue' : 'stop';
    }

    private async defensiveStep(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        const attackedAdjacent = await this.virtualPlayerMechanicsService.tryAttackAdjacent(session, bot);
        if (attackedAdjacent) {
            return 'stop';
        }

        if (this.virtualPlayerMechanicsService.canMove(bot)) {
            const nearestEnemy = this.virtualPlayerMechanicsService.findNearestEnemy(session, bot);
            if (nearestEnemy?.character.position) {
                const fleeTarget = this.virtualPlayerMechanicsService.findFleeTarget(session, bot, nearestEnemy);
                if (fleeTarget && !this.virtualPlayerMechanicsService.samePosition(fleeTarget, bot.character.position)) {
                    const moved = await this.virtualPlayerMechanicsService.moveTowardPosition(session, bot, fleeTarget);
                    if (moved) {
                        return 'continue';
                    }
                }
            }
        }

        return 'stop';
    }

}


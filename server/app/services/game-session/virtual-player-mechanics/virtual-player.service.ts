import { VirtualPlayerStepOutcome } from '@app/constants/virtual-player.constants';
import { GameSession } from '@app/domain/game-session';
import { Player } from '@common/player';
import { VirtualPlayerProfile } from '@common/virtual.player.profile';
import { Inject, Injectable } from '@nestjs/common';
import { VirtualPlayerCtfService } from './virtual-player-ctf.service';
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

        while (this.virtualPlayerMechanicsService.isBotCurrentPlayer(session, bot) && this.virtualPlayerMechanicsService.canContinueTurn(bot)) {
            const ctfOutcome = await this.virtualPlayerCtfService.handleStep(session, bot, bot.virtualProfile);
            if (!this.virtualPlayerMechanicsService.isBotCurrentPlayer(session, bot)) {
                return;
            }
            if (session.getActiveCombat()) {
                return;
            }

            if (ctfOutcome === VirtualPlayerStepOutcome.Continue) {
                continue;
            }
            if (ctfOutcome === VirtualPlayerStepOutcome.Stop) {
                return;
            }

            const classicOutcome = bot.virtualProfile === VirtualPlayerProfile.Aggressive
                ? await this.aggressiveStep(session, bot)
                : await this.defensiveStep(session, bot);

            if (session.getActiveCombat()) {
                return;
            }

            if (classicOutcome === VirtualPlayerStepOutcome.Continue) {
                continue;
            }

            return;
        }
    }

    private async aggressiveStep(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        const attacked = await this.virtualPlayerMechanicsService.tryAttackAdjacent(session, bot);
        if (attacked) {
            return VirtualPlayerStepOutcome.Continue;
        }

        const usedSanctuary = await this.virtualPlayerMechanicsService.tryUseAdjacentSanctuary(session, bot);
        if (usedSanctuary) {
            return VirtualPlayerStepOutcome.Continue;
        }

        if (!this.virtualPlayerMechanicsService.canMove(bot)) {
            return VirtualPlayerStepOutcome.Stop;
        }

        const nearestEnemy = this.virtualPlayerMechanicsService.findNearestEnemy(session, bot);
        if (!nearestEnemy?.character.position) {
            return VirtualPlayerStepOutcome.Stop;
        }

        const moved = await this.virtualPlayerMechanicsService.moveTowardEnemy(session, bot, nearestEnemy);
        return moved ? VirtualPlayerStepOutcome.Continue : VirtualPlayerStepOutcome.Stop;
    }

    private async defensiveStep(session: GameSession, bot: Player): Promise<VirtualPlayerStepOutcome> {
        const attackedAdjacent = await this.virtualPlayerMechanicsService.tryAttackAdjacent(session, bot);
        if (attackedAdjacent) {
            return VirtualPlayerStepOutcome.Continue;
        }

        const usedSanctuary = await this.virtualPlayerMechanicsService.tryUseAdjacentSanctuary(session, bot);
        if (usedSanctuary) {
            return VirtualPlayerStepOutcome.Continue;
        }

        if (this.virtualPlayerMechanicsService.canMove(bot)) {
            const nearestEnemy = this.virtualPlayerMechanicsService.findNearestEnemy(session, bot);
            if (nearestEnemy?.character.position) {
                const fleeTarget = this.virtualPlayerMechanicsService.findFleeTarget(session, bot, nearestEnemy);
                if (fleeTarget && !this.virtualPlayerMechanicsService.samePosition(fleeTarget, bot.character.position)) {
                    const moved = await this.virtualPlayerMechanicsService.moveTowardPosition(session, bot, fleeTarget);
                    if (moved) {
                        return VirtualPlayerStepOutcome.Continue;
                    }
                }
            }
        }

        return VirtualPlayerStepOutcome.Stop;
    }

}


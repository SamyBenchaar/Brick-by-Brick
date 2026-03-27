import { GameSession } from "@app/domain/game-session";
import { GameGateway } from "@app/gateways/game/game.gateway";
import { Player } from "@common/player";
import { VirtualPlayerProfile } from "@common/virtual.player.profile";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { CombatService } from "./combat.service";
import { MovementService } from "./movement.service";

@Injectable()
export class VirtualPlayerService {
    @Inject() CombatService: CombatService;
    @Inject() MovementService: MovementService;
    @Inject() GameGateway: GameGateway;
    private readonly logger = new Logger(VirtualPlayerService.name);



    async playTurn(session: GameSession, bot: Player): Promise<void> {
        this.logger.log(`Début du tour du joueur virtuel: ${bot.character.name} (${bot.virtualProfile})`);

        if (bot.virtualProfile === VirtualPlayerProfile.Aggressive) {
            await this.aggressiveBehavior(session, bot);
        }

        else if (bot.virtualProfile === VirtualPlayerProfile.Defensive) {
            await this.defensiveBehavior(session, bot);
        }

        else {
            this.logger.warn(`Profil de joueur virtuel inconnu: ${bot.virtualProfile}`);
        }
    }

    private async aggressiveBehavior(session: GameSession, bot: Player): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log("je me déplace agressivement");

        // TODO: Implémenter la logique de recherche et d'attaque
    }

    private async defensiveBehavior(session: GameSession, bot: Player): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log("je me déplace defensivement");

        // TODO: Implémenter la logique de fuite
    }
}


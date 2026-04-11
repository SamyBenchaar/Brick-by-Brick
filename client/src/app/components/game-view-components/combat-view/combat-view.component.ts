import { Component, computed, effect, inject, signal } from '@angular/core';
import { PlayerCombatCardComponent } from '@app/components/game-view-components/combat-view/player-combat-card/player-combat-card.component';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { COMBAT_POSTURE } from '@common/combat';

@Component({
  selector: 'app-combat-view',
  imports: [PlayerCombatCardComponent],
  templateUrl: './combat-view.component.html',
  styleUrl: './combat-view.component.scss',
})
export class CombatViewComponent {
  combatPosture = COMBAT_POSTURE;
  gamePlaySocketService = inject(GamePlaySocketService);
  combatSocketService = inject(CombatSocketService);

  self = this.combatSocketService.self;
  other = this.combatSocketService.other;
  latestRound = this.combatSocketService.latestRound;

  selfHp = this.combatSocketService.selfHp;
  otherHp = this.combatSocketService.otherHp;
  combatTurnTimeRemaining = this.combatSocketService.combatTurnTimeRemaining;

  hasChosen = signal<boolean>(false);
  posture = signal<string>(COMBAT_POSTURE.NONE);

  isSelfAttacker = computed(() => {
    const round = this.latestRound();
    const self = this.self();
    return round && self ? round.attackerId === self.id : false;
  });

  selfAttackDetail = computed(() => {
    const round = this.latestRound();
    if (!round) return null;
    return this.isSelfAttacker() ? round.attackerStrike.attack : round.defenderStrike.attack;
  });

  selfDefenseDetail = computed(() => {
    const round = this.latestRound();
    if (!round) return null;
    return this.isSelfAttacker() ? round.attackerStrike.defense : round.defenderStrike.defense;
  });

  otherAttackDetail = computed(() => {
    const round = this.latestRound();
    if (!round) return null;
    return this.isSelfAttacker() ? round.defenderStrike.attack : round.attackerStrike.attack;
  });

  otherDefenseDetail = computed(() => {
    const round = this.latestRound();
    if (!round) return null;
    return this.isSelfAttacker() ? round.defenderStrike.defense : round.attackerStrike.defense;
  });

  constructor() {
    effect(() => {
      const combat = this.combatSocketService.activeCombat();
      if (combat) {
        this.hasChosen.set(false);
      }
    });
  }

  setPosture(combatPosture: string): void {
    this.posture.set(combatPosture);
    this.gamePlaySocketService.chooseCombatPosture(combatPosture);
    this.hasChosen.set(true);
  }
}

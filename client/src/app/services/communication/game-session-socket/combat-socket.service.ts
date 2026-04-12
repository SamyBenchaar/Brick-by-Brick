import { computed, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { Character } from '@common/character';
import { ActiveCombat, CombatRoundResolvedPayload } from '@common/combat';
import { GamePlaySocketService } from './game-play-socket.service';

@Injectable({ providedIn: 'root' })
export class CombatSocketService {
    private readonly combatNotificationDelayMs = 3000;
    private gamePlaySocketService = inject(GamePlaySocketService);
    private combatNotificationTimeout: ReturnType<typeof setTimeout> | null = null;

    activeCombat: WritableSignal<ActiveCombat | null> = signal<ActiveCombat | null>(null);
    combatNotification: WritableSignal<string | null> = signal<string | null>(null);
    latestRound: WritableSignal<CombatRoundResolvedPayload | null> = signal<CombatRoundResolvedPayload | null>(null);
    readonly combatTurnTimeRemaining = signal<number | null>(null);

    combatParticipantIds = computed(() => {
        const combat = this.activeCombat();
        return combat ? [combat.attackerId, combat.defenderId] : [];
    });

    self = computed(() => this.getSelf());

    other = computed(() => this.getOther());

    selfHp = computed(() => {
        const combat = this.activeCombat();
        const self = this.getSelf();
        if (!combat || !self) return self?.life ?? 0;
        return combat.attackerId === self.id ? combat.attackerHp : combat.defenderHp;
    });

    otherHp = computed(() => {
        const combat = this.activeCombat();
        const other = this.getOther();
        if (!combat || !other) return other?.life ?? 0;
        return combat.attackerId === other.id ? combat.attackerHp : combat.defenderHp;
    });

    getSelf(): Character | null {
        return this.gamePlaySocketService.getCurrentPlayerCharacter();
    }

    getOther(): Character | null {
        const combat = this.activeCombat();
        const me = this.getSelf();

        if (!combat || !me) return null;

        const otherId = combat.attackerId === me.id ? combat.defenderId : combat.attackerId;
        return this.gamePlaySocketService.getCharacter(otherId) ?? null;
    }

    isCurrentUserInCombat(): boolean {
        const myId = this.getSelf()?.id;
        return !!myId && this.combatParticipantIds().includes(myId);
    }

    showCombatNotification(message: string): void {
        this.combatNotification.set(message);

        if (this.combatNotificationTimeout) {
            clearTimeout(this.combatNotificationTimeout);
        }

        this.combatNotificationTimeout = setTimeout(() => {
            this.clearCombatNotification();
        }, this.combatNotificationDelayMs);
    }

    clearCombatNotification(): void {
        if (this.combatNotificationTimeout) {
            clearTimeout(this.combatNotificationTimeout);
            this.combatNotificationTimeout = null;
        }

        this.combatNotification.set(null);
    }
}
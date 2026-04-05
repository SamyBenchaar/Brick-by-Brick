import { Injectable, signal, computed, WritableSignal, inject } from '@angular/core';
import { ActiveCombat } from '@common/combat';
import { GamePlaySocketService } from './game-play-socket.service';
import { Character } from '@common/character';
    
@Injectable({ providedIn: 'root' })
export class CombatSocketService {
    private gamePlaySocketService = inject(GamePlaySocketService);

    activeCombat: WritableSignal<ActiveCombat | null> = signal<ActiveCombat | null>(null);
    combatNotification: WritableSignal<string | null> = signal<string | null>(null);

    combatParticipantIds = computed(() => {
        const combat = this.activeCombat();
        return combat ? [combat.attackerId, combat.defenderId] : [];
    });

    self = computed(() => this.getSelf());

    other = computed(() => this.getOther());

    getSelf(): Character | null{
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
}
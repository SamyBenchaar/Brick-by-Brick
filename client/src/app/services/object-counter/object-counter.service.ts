import { Injectable } from '@angular/core';
import { ObjectType } from '@common/map';

@Injectable({
  providedIn: 'root',
})
export class ObjectCounterService {
  private counts: Record<ObjectType, number> = {

    [ObjectType.StartingPoint]: 0,
    [ObjectType.HealingSanctuary]: 0,
    [ObjectType.CombatSanctuary]: 0,
    [ObjectType.Flag]: 0,
  };
  private maxCounts: Record<ObjectType, number> = {

    [ObjectType.StartingPoint]: 2,
    [ObjectType.HealingSanctuary]: 1,
    [ObjectType.CombatSanctuary]: 1,
    [ObjectType.Flag]: 1,
  };

  set startPoint(number: number) {
    this.maxCounts[ObjectType.StartingPoint] = number;
  }

  set healingSanctuary(number: number) {
    this.maxCounts[ObjectType.HealingSanctuary] = number;
  }

  set combatSanctuary(number: number) {
    this.maxCounts[ObjectType.CombatSanctuary] = number;
  }

  canPlace(object: ObjectType): boolean {
    if (this.counts[object] < this.maxCounts[object]) {
      return true;
    }
    return false;
  };

  place(object: ObjectType): void {
    this.counts[object] = this.getCount(object) + 1;
  };

  remove(object: ObjectType): void {
    this.counts[object] = this.getCount(object) - 1;
  }

  getCount(object: ObjectType): number {
    return this.counts[object];
  }

  getMaxCount(object: ObjectType): number {
    return this.maxCounts[object];
  }

  getRemainingCount(object: ObjectType): number {
    return Math.max(this.maxCounts[object] - this.counts[object], 0);
  }

  reset(): void {
    for (const key in this.counts) {
      if (key) {
        this.counts[key as ObjectType] = 0;
      }
    }
  }
}

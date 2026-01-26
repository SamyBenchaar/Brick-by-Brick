import { Injectable } from '@angular/core';
import { ObjectType } from '@common/map';

@Injectable({
  providedIn: 'root',
})
export class ObjectCounterService {
  private counts: Record<ObjectType, number> = {
    [ObjectType.FLAG]: 0,
    [ObjectType.HEALINGSANCTUARY]: 0,
    [ObjectType.COMBATSANCTUARY]: 0,
    [ObjectType.STARTPOINT]: 0,
  };
  private maxCounts: Record<ObjectType, number> = {
    [ObjectType.FLAG]: 1,
    [ObjectType.HEALINGSANCTUARY]: 1,
    [ObjectType.COMBATSANCTUARY]: 1,
    [ObjectType.STARTPOINT]: 2,
  };

  canPlace(object: ObjectType) {
    if(this.counts[object] < this.maxCounts[object]) {
      return true;
    }
    return false;
  };

  place(object: ObjectType):void {
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
    return Math.max(this.maxCounts[object] - this.counts[object], 0 );
  }
}

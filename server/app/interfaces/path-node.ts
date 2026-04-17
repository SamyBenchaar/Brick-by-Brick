import { Position } from '@common/position';

export interface PathNode {
    cost: number;
    from: Position | null;
}

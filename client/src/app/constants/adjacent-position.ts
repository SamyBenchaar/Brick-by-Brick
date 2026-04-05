import { Position } from '@common/position';

export const ADJACENT_POSITIONS: Position[] = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
];

export const ADJACENT_TO_ORIGIN_POSITION: number[][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
];
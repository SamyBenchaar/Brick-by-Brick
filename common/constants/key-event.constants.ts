export enum Direction {
  ArrowUp = 'arrowUp',
  ArrowDown = 'arrowDown',
  ArrowLeft = 'arrowLeft',
  ArrowRight = 'arrowRight',
}

export const KEY_DIRECTION_MAP: Record<string, Direction> = {
  w: Direction.ArrowUp,
  arrowup: Direction.ArrowUp,
  a: Direction.ArrowLeft,
  arrowleft: Direction.ArrowLeft,
  s: Direction.ArrowDown,
  arrowdown: Direction.ArrowDown,
  d: Direction.ArrowRight,
  arrowright: Direction.ArrowRight,
};

export const KEY_ENTER = 'enter';
export const KEY_DEBUG = 'm';
export const HEALING_SANCTUARY_BONUS = 2;
export const COMBAT_SANCTUARY_BONUS = 1;
export const DOUBLE_SANCTUARY_BONUS = 2;
export const DOUBLE_SANCTUARY_BONUS_CHANCE = 0.5;
export const SANCTUARY_COOLDOWN_TURNS = 3;

export const ADJACENT_TO_ORIGIN_POSITION: number[][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
];

export const ADJACENT_POSITIONS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
];

export const ORIGIN_CANDIDATES = [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: -1, dy: -1 },
];

export const SANCTUARY_TILE_OFFSETS = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
];

export const SANCTUARYLABEL: Record<string, string> = {
    combatsanctuary: 'sanctuaire de combat',
    healingsanctuary: 'sanctuaire de soin',
};

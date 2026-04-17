import { Dice } from './dice';
import { Position } from './position';
import { TeamId } from './team';

export interface Character {
  id: string;
  isActif: boolean;
  battlesWon: number;
  name: string;
  avatarId: number;
  maxLife: number;
  life: number;
  speed: number;
  attack: number;
  defense: number;
  movements: number;
  actions: number;
  attackDice: Dice;
  defenseDice: Dice;
  position?: Position;
  remainingMovement?: number;
  remainingActions?: number;
  victories?: number;
  startPosition?: Position;
  hasCombatSanctuaryBonus?: boolean;
  combatSanctuaryBonus?: number;
  team?: TeamId;
  hasFlag?: boolean;
  defeats: number;
  totalDamageDealt: number
  totalDamageReceived: number
  tilesVisited: number
}


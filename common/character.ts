import { Dice } from '@common/dice';
import { Position } from '@common/gameSession';

export class Character {
  private _id: string;
  socketId: string;

  constructor(
    private _name: string,
    private _avatarId: number,

    private _life: number,
    private _speed: number,
    private _attack: number,
    private _defense: number,

    private _attackDice: Dice,
    private _defenseDice: Dice,

    private _victories: number,
    private _position: Position,
    private _startPosition: Position,
    private _isActive: boolean,
    private _resetMovement: () => void,
    private _moveTo: (position: Position) => void,
    private _addVictory: () => void,
  ) {};

  get id(): string {
    return this._id;
  }
  get name(): string {
    return this._name;
  }
  get victories(): number {
    return this._victories;
  }
  get position(): Position {
    return this._position;
  }
  get avatarId(): number {
    return this._avatarId;
  }
  get life(): number {
    return this._life;
  }
  get speed(): number {
    return this._speed;
  }
  get attack(): number {
    return this._attack;
  }
  get defense(): number {
    return this._defense;
  }
  get attackDice(): Dice {
    return this._attackDice;
  }
  get defenseDice(): Dice {
    return this._defenseDice;
  }
  get startPosition(): Position {
    return this._startPosition;
  }

  set id(value: string) {
    this._id = value;
  }
  set name(value: string) {
    this._name = value;
  }
  set avatarId(value: number) {
    this._avatarId = value;
  }
  set life(value: number) {
    this._life = value;
  }
  set speed(value: number) {
    this._speed = value;
  }
  set attack(value: number) {
    this._attack = value;
  }
  set defense(value: number) {
    this._defense = value;
  }
  set attackDice(value: Dice) {
    this._attackDice = value;
  }
  set defenseDice(value: Dice) {
    this._defenseDice = value;
  }
  set victories(value: number) {
    this._victories = value;
  }
  set position(value: Position) {
    this._position = value;
  }
  set startPosition(value: Position) {
    this._startPosition = value;
  }
  set isActive(value: boolean) {
    this._isActive = value;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  resetMovement(): void {
    this._resetMovement();
  }
  moveTo(position: Position): void {
    this._moveTo(position);
  }
  addVictory(): void {
    this._addVictory();
  }
}


import { Dice } from '@common/dice';

export class Character {
  private _id: string;
  private _isActif: boolean = false;
  private _battlesWon: number = 0;

  constructor(
    private _name: string,
    private _avatarId: number,

    private _maxLife: number,
    private _life: number,
    private _speed: number,
    private _attack: number,
    private _defense: number,
    private _movements: number,
    private _actions: number,

    private _attackDice: Dice,
    private _defenseDice: Dice,
  ) {};

  get id(): string {
    return this._id;
  }
  get isActif(): boolean {
    return this._isActif;
  }
  get battleWon(): number {
    return this._battlesWon;
  }
  get name(): string {
    return this._name;
  }
  get avatarId(): number {
    return this._avatarId;
  }
  get maxLife(): number {
    return this._maxLife;
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
  get movements(): number{
    return this._movements;
  }
  get actions(): number{
    return this._actions;
  }
  get attackDice(): Dice {
    return this._attackDice;
  }
  get defenseDice(): Dice {
    return this._defenseDice;
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
  set maxLife(value: number){
    this._maxLife = value;
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
  set movements(value: number) {
    this._movements = value;
  }
  set actions(value: number) {
    this._actions = value;
  }
  set attackDice(value: Dice) {
    this._attackDice = value;
  }
  set defenseDice(value: Dice) {
    this._defenseDice = value;
  }

  toggleActif(): void {
    this._isActif = !this._isActif;
  }

  addWin(): void {
    this._battlesWon++;
  }

}

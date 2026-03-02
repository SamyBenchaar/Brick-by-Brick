import { Dice } from '@common/dice';

export class Character {
  private id: string;

  constructor (
    private name: string,
    private avatarId: number,

    private life: number,
    private speed: number,
    private attack: number,
    private defense: number,

    private attackDice: Dice,
    private defenseDice: Dice,
  ){};

  getId(): string {
    return this.id;
  }
  getName(): string {
    return this.name;
  }
  getAvatarId(): number {
    return this.avatarId;
  }
  getLife(): number {
    return this.life;
  }
  getSpeed(): number {
    return this.speed;
  }
  getAttack(): number {
    return this.attack;
  }
  getDefense(): number {
    return this.defense;
  }
  getAttackDice(): Dice {
    return this.attackDice;
  }
  getDefenseDice(): Dice {
    return this.defenseDice;
  }

  setName(name: string): void {
    this.name = name;
  }
  setAvatarId(avatarId: number): void {
    this.avatarId = avatarId;
  }
  setLife(life: number): void {
    this.life = life;
  }
  setSpeed(speed: number): void {
    this.speed = speed;
  }
  setAttack(attack: number): void {
    this.attack = attack;
  }
  setDefense(defense: number): void {
    this.defense = defense;
  }
  setAttackDice(attackDice: Dice): void {
    this.attackDice = attackDice;
  }
  setDefenseDice(defenseDice: Dice): void {
    this.defenseDice = defenseDice;
  }
}

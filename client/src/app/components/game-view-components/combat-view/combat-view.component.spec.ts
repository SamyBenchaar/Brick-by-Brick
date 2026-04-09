import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatSocketService } from '@app/services/communication/game-session-socket/combat-socket.service';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';
import { CombatViewComponent } from './combat-view.component';
import { signal } from '@angular/core';

const TEST_HP = 10;
const TURN_TIME = 15;

const mockCombatSocketService = {
  self: signal({
    id: 1,
    name: 'Player 1',
    avatarId: 1,
  }),
  other: signal({
    id: 2,
    name: 'Player 2',
    avatarId: 1,
  }),
  latestRound: signal(null),
  selfHp: signal(TEST_HP),
  otherHp: signal(TEST_HP),
  combatTurnTimeRemaining: signal(TURN_TIME),
  activeCombat: signal(null),
};

const mockGamePlaySocketService = {
  chooseCombatPosture: jasmine.createSpy('chooseCombatPosture'),
};

describe('CombatViewComponent', () => {
  let component: CombatViewComponent;
  let fixture: ComponentFixture<CombatViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatViewComponent],
      providers: [
        { provide: CombatSocketService, useValue: mockCombatSocketService },
        { provide: GamePlaySocketService, useValue: mockGamePlaySocketService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CombatViewComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GamePlaySocketService } from '@app/services/communication/game-session-socket/game-play-socket.service';

import { CombatViewComponent } from './combat-view.component';

describe('CombatViewComponent', () => {
  let component: CombatViewComponent;
  let fixture: ComponentFixture<CombatViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CombatViewComponent],
      providers: [{
        provide: GamePlaySocketService,
        useValue: {
          combatState: signal(null),
          isMyCombatTurn: () => false,
          chooseCombatPosture: () => undefined,
        },
      }],
    })
      .compileComponents();

    fixture = TestBed.createComponent(CombatViewComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

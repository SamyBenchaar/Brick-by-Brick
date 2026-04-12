import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GlobalGameStatisticsComponent } from './global-game-statistics.component';

describe('GlobalGameStatisticsComponent', () => {
  let component: GlobalGameStatisticsComponent;
  let fixture: ComponentFixture<GlobalGameStatisticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlobalGameStatisticsComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GlobalGameStatisticsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TileTypeSidebarComponent } from './tile-type-sidebar.component';

describe('TileTypeSidebarComponent', () => {
  let component: TileTypeSidebarComponent;
  let fixture: ComponentFixture<TileTypeSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TileTypeSidebarComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TileTypeSidebarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

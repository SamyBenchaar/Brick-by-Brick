import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObjectSidebarComponent } from './object-sidebar.component';

describe('ObjectSidebarComponent', () => {
  let component: ObjectSidebarComponent;
  let fixture: ComponentFixture<ObjectSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectSidebarComponent],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ObjectSidebarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

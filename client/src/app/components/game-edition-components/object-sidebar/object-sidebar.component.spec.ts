import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { ObjectSidebarComponent } from './object-sidebar.component';

describe('ObjectSidebarComponent', () => {
  let component: ObjectSidebarComponent;
  let fixture: ComponentFixture<ObjectSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectSidebarComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: { size: 'small' },
            },
          },
        },
      ],
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

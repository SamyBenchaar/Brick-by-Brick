import { TestBed } from '@angular/core/testing';

import { ObjectCounterService } from './object-counter.service';

describe('ObjectCounterService', () => {
  let service: ObjectCounterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ObjectCounterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

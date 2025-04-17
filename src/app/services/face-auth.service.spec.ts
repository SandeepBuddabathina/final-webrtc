import { TestBed } from '@angular/core/testing';

import { FaceAuthService } from './face-auth.service';

describe('FaceAuthService', () => {
  let service: FaceAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceAuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

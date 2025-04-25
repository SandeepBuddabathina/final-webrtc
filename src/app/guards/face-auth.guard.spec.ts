import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { faceAuthGuard } from './face-auth.guard';

describe('faceAuthGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => faceAuthGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});

import { TestBed } from '@angular/core/testing';

import { FaceExpressionService } from './face-expression.service';

describe('FaceExpressionService', () => {
  let service: FaceExpressionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FaceExpressionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaceAuthComponent } from './face-auth.component';

describe('FaceAuthComponent', () => {
  let component: FaceAuthComponent;
  let fixture: ComponentFixture<FaceAuthComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [FaceAuthComponent]
    });
    fixture = TestBed.createComponent(FaceAuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

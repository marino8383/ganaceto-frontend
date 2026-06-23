import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bacheca } from './bacheca';

describe('Bacheca', () => {
  let component: Bacheca;
  let fixture: ComponentFixture<Bacheca>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bacheca],
    }).compileComponents();

    fixture = TestBed.createComponent(Bacheca);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

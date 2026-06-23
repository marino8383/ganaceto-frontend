import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Casina } from './casina';

describe('Casina', () => {
  let component: Casina;
  let fixture: ComponentFixture<Casina>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Casina],
    }).compileComponents();

    fixture = TestBed.createComponent(Casina);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

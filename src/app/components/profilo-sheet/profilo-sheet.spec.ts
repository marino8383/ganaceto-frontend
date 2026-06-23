import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfiloSheet } from './profilo-sheet';

describe('ProfiloSheet', () => {
  let component: ProfiloSheet;
  let fixture: ComponentFixture<ProfiloSheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfiloSheet],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfiloSheet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

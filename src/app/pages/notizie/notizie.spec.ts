import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Notizie } from './notizie';

describe('Notizie', () => {
  let component: Notizie;
  let fixture: ComponentFixture<Notizie>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notizie],
    }).compileComponents();

    fixture = TestBed.createComponent(Notizie);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

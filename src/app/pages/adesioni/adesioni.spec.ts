import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Adesioni } from './adesioni';

describe('Adesioni', () => {
  let component: Adesioni;
  let fixture: ComponentFixture<Adesioni>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adesioni],
    }).compileComponents();

    fixture = TestBed.createComponent(Adesioni);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

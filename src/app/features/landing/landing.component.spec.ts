import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let mockRouter: any;

  beforeEach(async () => {
    mockRouter = { navigate: () => {} };

    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        { provide: Router, useValue: mockRouter }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with correct default values', () => {
    expect(component.isScrolled).toBe(false);
    expect(component.activeSection).toBe('home');
    expect(component.sections.length).toBeGreaterThan(0);
  });

  it('should return current year', () => {
    const currentYear = new Date().getFullYear();
    expect(component.getCurrentYear()).toBe(currentYear);
  });

  it('should update isScrolled on scroll', () => {
    // Simulate scroll event
    window.scrollY = 100;
    component.onWindowScroll();
    expect(component.isScrolled).toBe(true);
  });
});

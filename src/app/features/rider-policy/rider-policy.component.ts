import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-rider-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rider-policy.component.html',
  styleUrl: './rider-policy.component.scss',
})
export class RiderPolicyComponent {
  constructor(private router: Router) {}

  navigateHome(): void {
    this.router.navigate(['/']);
  }
}

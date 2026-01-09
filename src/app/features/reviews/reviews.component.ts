import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Reviews & Ratings</h1>
        <p class="page-subtitle">Customer feedback and ratings</p>
      </div>
      <div class="placeholder-content">
        <i class="fas fa-star"></i>
        <h3>Reviews Module</h3>
        <p>Customer reviews and ratings management coming soon</p>
      </div>
    </div>
  `,
  styles: [`
    @use '../../../styles/variables' as *;
    @use '../../../styles/mixins' as *;
    
    .page-container {
      animation: fadeIn 0.3s;
    }
    
    .page-header {
      margin-bottom: 2rem;
      
      .page-title {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
      }
      
      .page-subtitle {
        color: #999999;
      }
    }
    
    .placeholder-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem;
      background: #1E1E1E;
      border-radius: 12px;
      text-align: center;
      
      i {
        font-size: 4rem;
        color: #B02121;
        margin-bottom: 1rem;
      }
      
      h3 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
      }
      
      p {
        color: #999999;
      }
    }
  `]
})
export class ReviewsComponent {}

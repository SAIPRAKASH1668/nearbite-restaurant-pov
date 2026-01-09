import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1 class="page-title">Reports & Analytics</h1>
        <p class="page-subtitle">Track your business performance</p>
      </div>
      <div class="placeholder-content">
        <i class="fas fa-chart-bar"></i>
        <h3>Reports Module</h3>
        <p>Detailed analytics and reports coming soon</p>
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
export class ReportsComponent {}

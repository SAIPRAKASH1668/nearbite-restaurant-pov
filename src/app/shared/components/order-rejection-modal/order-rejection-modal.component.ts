import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-order-rejection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible" (click)="close()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Reject Order</h3>
          <button class="close-btn" (click)="close()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <p class="modal-subtitle">Select a reason for rejection:</p>
          <div class="reason-chips">
            <button 
              *ngFor="let reason of predefinedReasons"
              class="chip"
              [class.selected]="selectedReason === reason"
              (click)="selectReason(reason)"
            >
              {{reason}}
            </button>
          </div>
          
          <textarea 
            *ngIf="selectedReason === 'Other'"
            class="custom-reason"
            [(ngModel)]="customReason"
            placeholder="Please specify the reason..."
            rows="3"
          ></textarea>
        </div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" (click)="close()">Cancel</button>
          <button 
            class="btn btn-danger" 
            (click)="confirm()"
            [disabled]="!canConfirm()"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-card {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 500px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease;
      overflow: hidden;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      padding: 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #111827;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      color: #9ca3af;
      cursor: pointer;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .modal-body {
      padding: 24px;
    }

    .modal-subtitle {
      color: #6b7280;
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 500;
    }

    .reason-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .chip {
      padding: 10px 20px;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 24px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      font-weight: 500;
      color: #4b5563;
    }

    .chip:hover {
      border-color: #667eea;
      color: #667eea;
      transform: translateY(-1px);
    }

    .chip.selected {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: #667eea;
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .custom-reason {
      width: 100%;
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.2s;
    }

    .custom-reason:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .custom-reason::placeholder {
      color: #9ca3af;
    }

    .modal-actions {
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      background: #f9fafb;
    }

    .btn {
      padding: 10px 24px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-secondary {
      background: white;
      color: #4b5563;
      border: 2px solid #e5e7eb;
    }

    .btn-secondary:hover {
      background: #f9fafb;
      border-color: #d1d5db;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background: #dc2626;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .btn-danger:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 640px) {
      .modal-card {
        width: 95%;
        max-height: 90vh;
        overflow-y: auto;
      }

      .reason-chips {
        gap: 6px;
      }

      .chip {
        padding: 8px 16px;
        font-size: 13px;
      }
    }
  `]
})
export class OrderRejectionModalComponent {
  @Input() isVisible = false;
  @Output() reject = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  predefinedReasons = [
    'Out of ingredients',
    'Kitchen too busy',
    'Item unavailable',
    'Closing soon',
    'Other'
  ];
  
  selectedReason = '';
  customReason = '';

  selectReason(reason: string) {
    this.selectedReason = reason;
    if (reason !== 'Other') {
      this.customReason = '';
    }
  }

  canConfirm(): boolean {
    return this.selectedReason !== '' && 
           (this.selectedReason !== 'Other' || this.customReason.trim() !== '');
  }

  confirm() {
    const reason = this.selectedReason === 'Other' 
      ? this.customReason.trim()
      : this.selectedReason;
    this.reject.emit(reason);
    this.reset();
  }

  close() {
    this.cancel.emit();
    this.reset();
  }

  reset() {
    this.selectedReason = '';
    this.customReason = '';
  }
}

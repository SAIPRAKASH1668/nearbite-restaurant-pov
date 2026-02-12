import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Restaurant Status Toggle Component
 * 
 * A reusable toggle switch component for controlling restaurant online/offline status.
 * Integrates seamlessly with the existing dark theme.
 * 
 * Features:
 * - Two-way binding with isOpen state
 * - Confirmation modal when going offline
 * - Smooth animations and transitions
 * - Fully accessible (ARIA support + keyboard navigation)
 * - Theme-consistent styling
 * 
 * @example
 * <app-restaurant-status-toggle
 *   [isOpen]="restaurant.isOpen"
 *   (isOpenChange)="onStatusChange($event)">
 * </app-restaurant-status-toggle>
 */
@Component({
  selector: 'app-restaurant-status-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './restaurant-status-toggle.component.html',
  styleUrls: ['./restaurant-status-toggle.component.scss']
})
export class RestaurantStatusToggleComponent {
  /** Current open/close status of the restaurant */
  @Input() isOpen: boolean = false;
  
  /** Optional disabled state for the toggle */
  @Input() disabled: boolean = false;
  
  /** Event emitted when the status changes */
  @Output() isOpenChange = new EventEmitter<boolean>();
  
  /** Controls the visibility of the confirmation modal */
  showConfirmationModal: boolean = false;
  
  /**
   * Handles toggle click events
   * - If closing (going offline): Shows confirmation modal
   * - If opening (going online): Directly changes status
   */
  onToggleClick(): void {
    if (this.isOpen) {
      this.showConfirmationModal = true;
    } else {
      this.changeStatus(true);
    }
  }
  
  /**
   * Keyboard accessibility handler
   * Allows Space and Enter keys to toggle the switch
   */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.disabled) {
      return;
    }
    
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.onToggleClick();
    }
  }
  
  /**
   * Confirms the status change to offline
   */
  confirmGoOffline(): void {
    this.changeStatus(false);
    this.showConfirmationModal = false;
  }
  
  /**
   * Cancels the offline status change
   */
  cancelGoOffline(): void {
    this.showConfirmationModal = false;
  }
  
  /**
   * Changes the restaurant status and emits the change event
   * @param newStatus - The new open/close status
   */
  private changeStatus(newStatus: boolean): void {
    this.isOpen = newStatus;
    this.isOpenChange.emit(newStatus);
  }
}

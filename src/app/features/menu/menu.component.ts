import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { NotificationService } from '../../shared/components/notification/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit, OnDestroy {
  selectedCategory = 'all';
  showAddItemForm = false;
  loading = true;
  customCategoryName = '';
  savingItem = false;
  isEditMode = false;
  editingItemId: string | null = null;
  
  private menuSubscription?: Subscription;
  
  categories: string[] = ['All'];

  newItem: Partial<MenuItem> = {
    itemName: '',
    category: '',
    price: 0,
    isAvailable: true,
    description: '',
    isVeg: true,
    image: ''
  };

  menuItems: MenuItem[] = [];

  constructor(
    private menuService: MenuService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    
    // Subscribe to loading state
    this.menuService.loading$.subscribe(isLoading => {
      this.loading = isLoading;
      if (isLoading) {
        // Clear items when loading to show spinner
        this.menuItems = [];
      }
      this.cdr.detectChanges();
    });
    
    // Subscribe to menu items
    this.menuSubscription = this.menuService.menuItems$.subscribe(items => {
      console.log('📦 Menu items updated:', items.length, 'items');
      this.menuItems = items;
      this.updateCategories(items);
      this.cdr.detectChanges();
    });
    
    // Fetch menu items
    this.menuService.fetchMenuItems();
  }

  ngOnDestroy(): void {
    this.menuSubscription?.unsubscribe();
  }

  updateCategories(items: MenuItem[]): void {
    // Extract unique categories from menu items
    const uniqueCategories = [...new Set(items.map(item => item.category))];
    // Sort categories alphabetically
    uniqueCategories.sort();
    // Always include 'All' as first category
    this.categories = ['All', ...uniqueCategories];
    
    // Set default category for new items if not set
    if (!this.newItem.category && uniqueCategories.length > 0) {
      this.newItem.category = uniqueCategories[0];
    }
    
    console.log('📋 Categories extracted:', this.categories);
  }

  selectCategory(category: string): void {
    this.selectedCategory = category.toLowerCase();
  }

  getFilteredItems(): MenuItem[] {
    if (this.selectedCategory === 'all') {
      return this.menuItems;
    }
    return this.menuItems.filter(
      item => item.category.toLowerCase() === this.selectedCategory
    );
  }

  toggleAvailability(itemId: string): void {
    const item = this.menuItems.find(i => i.itemId === itemId);
    if (item) {
      const newStatus = !item.isAvailable;
      const updatedItemData: Partial<MenuItem> = {
        itemName: item.itemName,
        category: item.category,
        price: item.price,
        isVeg: item.isVeg,
        isAvailable: newStatus,
        description: item.description,
        image: item.image
      };

      this.loading = true;
      this.menuService.updateMenuItem(itemId, updatedItemData).subscribe({
        next: () => {
          console.log('✅ Item availability updated');
          const statusText = newStatus ? 'available' : 'unavailable';
          this.notificationService.success(`${item.itemName} marked as ${statusText}`);
        },
        error: (err) => {
          console.error('❌ Error updating availability:', err);
          this.notificationService.error('Failed to update item availability');
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  openAddItemForm(): void {
    this.isEditMode = false;
    this.editingItemId = null;
    this.showAddItemForm = true;
    this.resetForm();
  }

  openEditItemForm(item: MenuItem): void {
    this.isEditMode = true;
    this.editingItemId = item.itemId;
    this.newItem = {
      itemName: item.itemName,
      category: item.category,
      price: item.price,
      isAvailable: item.isAvailable,
      description: item.description,
      isVeg: item.isVeg,
      image: item.image
    };
    this.showAddItemForm = true;
  }

  closeAddItemForm(): void {
    this.showAddItemForm = false;
    this.isEditMode = false;
    this.editingItemId = null;
    this.resetForm();
  }

  onCategoryChange(event: any): void {
    const value = event.target.value;
    if (value === '_new') {
      this.customCategoryName = '';
    }
  }

  resetForm(): void {
    this.newItem = {
      itemName: '',
      category: this.categories.length > 1 ? this.categories[1] : '',
      price: 0,
      isAvailable: true,
      description: '',
      isVeg: true,
      image: ''
    };
    this.customCategoryName = '';
  }

  saveNewItem(): void {
    // Handle custom category
    if (this.newItem.category === '_new' && this.customCategoryName.trim()) {
      this.newItem.category = this.customCategoryName.trim();
    }

    // Validate required fields
    if (!this.newItem.itemName || !this.newItem.category || !this.newItem.price || this.newItem.price <= 0) {
      this.notificationService.warning('Please fill all required fields');
      return;
    }

    this.savingItem = true;

    if (this.isEditMode && this.editingItemId) {
      // Update existing item
      this.menuService.updateMenuItem(this.editingItemId, this.newItem).subscribe({
        next: (updatedItem) => {
          console.log('✅ Menu item updated:', updatedItem);
          this.notificationService.success(`${this.newItem.itemName} updated successfully!`);
          this.closeAddItemForm();
          this.savingItem = false;
        },
        error: (error) => {
          console.error('❌ Error updating menu item:', error);
          this.notificationService.error('Failed to update menu item. Please try again.');
          this.savingItem = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Add new item
      this.menuService.addMenuItem(this.newItem).subscribe({
        next: (addedItem) => {
          console.log('✅ Menu item added:', addedItem);
          this.notificationService.success(`${this.newItem.itemName} added successfully!`);
          this.closeAddItemForm();
          this.savingItem = false;
        },
        error: (error) => {
          console.error('❌ Error adding menu item:', error);
          this.notificationService.error('Failed to add menu item. Please try again.');
          this.savingItem = false;
          this.cdr.detectChanges();
        }
      });
    }
  }
}

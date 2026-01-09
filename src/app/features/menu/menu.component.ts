import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  available: boolean;
  image?: string;
  description?: string;
  preparationTime?: number;
  isVeg?: boolean;
  spicyLevel?: string;
}

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent {
  selectedCategory = 'all';
  showAddItemForm = false;
  
  categories = ['All', 'Main Course', 'Starters', 'Breads', 'Desserts', 'Beverages'];

  newItem: MenuItem = {
    id: '',
    name: '',
    category: 'Main Course',
    price: 0,
    available: true,
    description: '',
    preparationTime: 15,
    isVeg: true,
    spicyLevel: 'medium'
  };

  menuItems: MenuItem[] = [
    { id: '1', name: 'Butter Chicken', category: 'Main Course', price: 350, available: true },
    { id: '2', name: 'Paneer Tikka', category: 'Starters', price: 280, available: true },
    { id: '3', name: 'Biryani', category: 'Main Course', price: 320, available: true },
    { id: '4', name: 'Naan', category: 'Breads', price: 40, available: true },
    { id: '5', name: 'Dal Makhani', category: 'Main Course', price: 220, available: false },
    { id: '6', name: 'Gulab Jamun', category: 'Desserts', price: 80, available: true },
    { id: '7', name: 'Lassi', category: 'Beverages', price: 60, available: true },
    { id: '8', name: 'Tandoori Chicken', category: 'Starters', price: 380, available: true }
  ];

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
    const item = this.menuItems.find(i => i.id === itemId);
    if (item) {
      item.available = !item.available;
    }
  }

  openAddItemForm(): void {
    this.showAddItemForm = true;
    this.resetForm();
  }

  closeAddItemForm(): void {
    this.showAddItemForm = false;
    this.resetForm();
  }

  resetForm(): void {
    this.newItem = {
      id: '',
      name: '',
      category: 'Main Course',
      price: 0,
      available: true,
      description: '',
      preparationTime: 15,
      isVeg: true,
      spicyLevel: 'medium'
    };
  }

  saveNewItem(): void {
    if (this.newItem.name && this.newItem.price > 0) {
      const item: MenuItem = {
        ...this.newItem,
        id: (this.menuItems.length + 1).toString()
      };
      this.menuItems.push(item);
      this.closeAddItemForm();
      alert('Menu item added successfully!');
    }
  }
}

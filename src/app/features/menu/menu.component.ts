import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuService, MenuItem } from '../../core/services/menu.service';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
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

  // ── Item image upload state ────────────────────────────────────────────────
  pendingImageFiles: File[] = [];
  pendingImagePreviews: string[] = [];
  readonly MAX_ITEM_IMAGES = 6;
  private readonly MAX_ITEM_IMAGE_MB = 10;
  
  private menuSubscription?: Subscription;
  
  categories: string[] = ['All'];

  newItem: Partial<MenuItem> = {
    itemName: '',
    category: '',
    price: 0,
    isAvailable: true,
    description: '',
    isVeg: true,
    image: []
  };

  menuItems: MenuItem[] = [];

  constructor(
    private menuService: MenuService,
    private imageUploadService: ImageUploadService,
    private restaurantContext: RestaurantContextService,
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
    // Clear any pending uploads from a previous open
    this.pendingImageFiles = [];
    this.pendingImagePreviews = [];
    this.showAddItemForm = true;
  }

  closeAddItemForm(): void {
    this.showAddItemForm = false;
    this.isEditMode = false;
    this.editingItemId = null;
    this.pendingImageFiles = [];
    this.pendingImagePreviews = [];
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
      image: []
    };
    this.customCategoryName = '';
    this.pendingImageFiles = [];
    this.pendingImagePreviews = [];
  }

  async saveNewItem(): Promise<void> {
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

    try {
      if (this.isEditMode && this.editingItemId) {
        // ── EDIT FLOW ────────────────────────────────────────────────────────────
        // Keep existing saved URLs + append any newly uploaded ones
        const keptImages: string[] = [...(this.newItem.image ?? [])];
        if (this.pendingImageFiles.length) {
          const newUrls = await this.uploadAllPendingImages(this.editingItemId);
          keptImages.push(...newUrls);
        }
        await this.menuService.updateMenuItem(this.editingItemId, { ...this.newItem, image: keptImages }).toPromise();
        this.notificationService.success(`${this.newItem.itemName} updated successfully!`);

      } else {
        // ── CREATE FLOW ──────────────────────────────────────────────────────────
        // Step 1: Create item (no image yet) to obtain the itemId
        const created = await this.menuService.addMenuItemRaw({ ...this.newItem, image: [] }).toPromise();
        const newItemId = created!.itemId;

        if (this.pendingImageFiles.length && newItemId) {
          // Step 2: Upload all pending images in one API call
          const imageUrls = await this.uploadAllPendingImages(newItemId);
          // Step 3: Update item with CDN URLs (updateMenuItem auto-refreshes list)
          await this.menuService.updateMenuItem(newItemId, { ...this.newItem, image: imageUrls }).toPromise();
        } else {
          // No images — manually trigger list refresh
          this.menuService.fetchMenuItems();
        }

        this.notificationService.success(`${this.newItem.itemName} added to menu!`);
      }

      this.closeAddItemForm();

    } catch (err: any) {
      console.error('❌ Error saving menu item:', err);
      this.notificationService.error('Failed to save item. Please try again.');
    } finally {
      this.savingItem = false;
      this.cdr.detectChanges();
    }
  }

  // ── Item image handlers ──────────────────────────────────────────────────────
  async onItemImageSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      await this.addItemImageFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async onItemImageDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) {
      await this.addItemImageFiles(files);
    }
  }

  removeExistingImage(index: number): void {
    const imgs = [...(this.newItem.image ?? [])];
    imgs.splice(index, 1);
    this.newItem.image = imgs;
  }

  removePendingImage(index: number): void {
    this.pendingImageFiles.splice(index, 1);
    this.pendingImagePreviews.splice(index, 1);
  }

  get totalImageCount(): number {
    return (this.newItem.image?.length ?? 0) + this.pendingImagePreviews.length;
  }

  private async addItemImageFiles(files: File[]): Promise<void> {
    const maxBytes = this.MAX_ITEM_IMAGE_MB * 1024 * 1024;
    const slotsLeft = this.MAX_ITEM_IMAGES - this.totalImageCount;
    if (slotsLeft <= 0) {
      this.notificationService.warning(`Maximum ${this.MAX_ITEM_IMAGES} photos allowed`);
      return;
    }
    const toAdd = files.slice(0, slotsLeft);
    if (files.length > slotsLeft) {
      this.notificationService.warning(`Only ${slotsLeft} slot(s) remaining — added first ${slotsLeft}`);
    }
    for (const file of toAdd) {
      if (file.size > maxBytes) {
        this.notificationService.warning(`"${file.name}" exceeds ${this.MAX_ITEM_IMAGE_MB} MB and was skipped`);
        continue;
      }
      const preview = await this.imageUploadService.fileToBase64(file);
      this.pendingImageFiles.push(file);
      this.pendingImagePreviews.push(preview);
    }
    this.cdr.detectChanges();
  }

  private async uploadAllPendingImages(itemId: string): Promise<string[]> {
    if (!this.pendingImageFiles.length) return [];
    const restaurantId = this.restaurantContext.getRestaurantId();
    const base64List = await Promise.all(
      this.pendingImageFiles.map(f => this.imageUploadService.fileToBase64(f))
    );
    const response = await this.imageUploadService
      .uploadItemImages(restaurantId, itemId, base64List)
      .toPromise();
    return response?.images?.map((img: any) => img.url) ?? [];
  }
}

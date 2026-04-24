import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuService, MenuItem, AddOnOption } from '../../core/services/menu.service';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
import { NotificationService } from '../../shared/components/notification/notification.service';
import { ConfigService } from '../../core/services/config.service';
import { FoodCategoryService } from '../../core/services/food-category.service';
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
  savingItem = false;
  isEditMode = false;
  editingItemId: string | null = null;
  /** Max allowed hike % for the current restaurant price — updates reactively on new items */
  maxHikePercentage = 0;

  // ── Price Hike state ──────────────────────────────────────────────────────
  showPriceHikeModal = false;
  priceHikePercentage: number | null = null;
  applyingPriceHike = false;

  // ── Add-on options state ──────────────────────────────────────────────────
  /** Working copy of addon options for the open form */
  addonOptions: AddOnOption[] = [];

  // ── Item image upload state ────────────────────────────────────────────────
  pendingImageFiles: File[] = [];
  pendingImagePreviews: string[] = [];
  readonly MAX_ITEM_IMAGES = 6;
  private readonly MAX_ITEM_IMAGE_MB = 10;
  /** Subcategories shown in the form for the currently selected category */
  subCategories: string[] = [];
  private menuSubscription?: Subscription;

  /** Category filter tabs — derived from actual items in menu (not config) */
  categories: string[] = ['All'];

  /** Category options for the form — sourced from food-categories API */
  get formCategories(): string[] {
    return this.foodCategoryService.getCategories();
  }

  newItem: Partial<MenuItem> = {
    itemName: '',
    category: '',
    subCategory: '',
    restaurantPrice: 0,
    hikePercentage: 0,
    isAvailable: true,
    description: '',
    isVeg: true,
    image: [],
    addOnOptions: []
  };

  /** Customer-facing display price computed from restaurantPrice + hikePercentage (nearest 0.5). */
  get computedDisplayPrice(): number {
    const price = this.newItem.restaurantPrice ?? 0;
    const hike  = this.newItem.hikePercentage  ?? 0;
    return Math.round(price * (1 + hike / 100) * 2) / 2;
  }

  menuItems: MenuItem[] = [];

  constructor(
    private menuService: MenuService,
    private imageUploadService: ImageUploadService,
    private restaurantContext: RestaurantContextService,
    private notificationService: NotificationService,
    private configService: ConfigService,
    private foodCategoryService: FoodCategoryService,
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
      this.menuItems = items;
      this.updateCategoryTabs(items);
      this.cdr.detectChanges();
    });
    
    // Fetch menu items
    this.menuService.fetchMenuItems();

    // Load global config (hike thresholds) and food categories in parallel
    this.configService.loadConfig().subscribe();

    this.foodCategoryService.load().subscribe(map => {
      const cats = Object.keys(map).sort();
      if (!this.newItem.category && cats.length > 0) {
        this.newItem.category = cats[0];
        this.subCategories = map[cats[0]] ?? [];
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.menuSubscription?.unsubscribe();
  }

  updateCategoryTabs(items: MenuItem[]): void {
    // Filter tabs only reflect categories that have at least one item
    const unique = [...new Set(items.map(item => item.category).filter(Boolean))].sort();
    this.categories = ['All', ...unique];
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
        subCategory: item.subCategory,
        restaurantPrice: item.restaurantPrice,
        hikePercentage: item.hikePercentage,
        isVeg: item.isVeg,
        isAvailable: newStatus,
        description: item.description,
        image: item.image
      };

      this.loading = true;
      this.menuService.updateMenuItem(itemId, updatedItemData).subscribe({
        next: () => {
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

  openPriceHikeModal(): void {
    this.priceHikePercentage = null;
    this.showPriceHikeModal = true;
  }

  closePriceHikeModal(): void {
    this.showPriceHikeModal = false;
    this.priceHikePercentage = null;
  }

  applyPriceHike(): void {
    const pct = this.priceHikePercentage;
    if (pct === null || pct === undefined || isNaN(pct) || pct <= 0) {
      this.notificationService.warning('Enter a valid percentage greater than 0');
      return;
    }
    if (pct > 500) {
      this.notificationService.warning('Percentage cannot exceed 500%');
      return;
    }
    this.applyingPriceHike = true;
    this.menuService.bulkPriceHike(pct).subscribe({
      next: (res) => {
        this.notificationService.success(`Prices hiked by ${pct}% — ${res.updatedCount} item(s) updated`);
        this.closePriceHikeModal();
        this.applyingPriceHike = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Price hike failed:', err);
        this.notificationService.error('Failed to apply price hike. Please try again.');
        this.applyingPriceHike = false;
        this.cdr.detectChanges();
      }
    });
  }

  openEditItemForm(item: MenuItem): void {
    this.isEditMode = true;
    this.editingItemId = item.itemId;
    this.maxHikePercentage = this.configService.getMaxHikeForPrice(item.restaurantPrice);
    this.subCategories = this.foodCategoryService.getSubCategories(item.category);
    this.newItem = {
      itemName: item.itemName,
      category: item.category,
      subCategory: item.subCategory ?? '',
      restaurantPrice: item.restaurantPrice,
      hikePercentage: item.hikePercentage,
      isAvailable: item.isAvailable,
      description: item.description,
      isVeg: item.isVeg,
      image: item.image,
      addOnOptions: item.addOnOptions ? [...item.addOnOptions] : []
    };
    // Mirror addon options into the working array
    this.addonOptions = this.newItem.addOnOptions ? [...this.newItem.addOnOptions] : [];
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
    const cat = event.target.value as string;
    this.subCategories = this.foodCategoryService.getSubCategories(cat);
    this.newItem.subCategory = '';
  }

  resetForm(): void {
    this.maxHikePercentage = 0;
    const cats = this.foodCategoryService.getCategories();
    const defaultCat = cats.length > 0 ? cats[0] : '';
    this.subCategories = defaultCat ? this.foodCategoryService.getSubCategories(defaultCat) : [];
    this.newItem = {
      itemName: '',
      category: defaultCat,
      subCategory: '',
      restaurantPrice: 0,
      hikePercentage: 0,
      isAvailable: true,
      description: '',
      isVeg: true,
      image: [],
      addOnOptions: []
    };
    this.addonOptions = [];
    this.pendingImageFiles = [];
    this.pendingImagePreviews = [];
  }

  /**
   * Called when restaurantPrice changes on a NEW item.
   * Reactively updates the default hike % to the config max for the new price tier.
   */
  onRestaurantPriceChange(): void {
    if (this.isEditMode) return;
    const price = this.newItem.restaurantPrice ?? 0;
    this.maxHikePercentage = this.configService.getMaxHikeForPrice(price);
    this.newItem.hikePercentage = this.maxHikePercentage;
  }

  /**
   * Called when the hike % field changes — clamps value between 0 and config max.
   */
  onHikePercentageChange(): void {
    const max = this.maxHikePercentage;
    const current = this.newItem.hikePercentage ?? 0;
    if (current > max) this.newItem.hikePercentage = max;
    if (current < 0)   this.newItem.hikePercentage = 0;
  }

  async saveNewItem(): Promise<void> {
    // Validate required fields
    if (!this.newItem.itemName || !this.newItem.category || !this.newItem.restaurantPrice || this.newItem.restaurantPrice <= 0) {
      this.notificationService.warning('Please fill all required fields');
      return;
    }

    // Validate addon options
    for (const opt of this.addonOptions) {
      if (!opt.name.trim()) {
        this.notificationService.warning('All add-on options must have a name');
        return;
      }
      if (opt.extraPrice < 0) {
        this.notificationService.warning('Add-on extra price cannot be negative');
        return;
      }
    }

    // Sync working addon array into the item before saving
    this.newItem.addOnOptions = this.addonOptions.map((o, i) => ({
      optionId: o.optionId || `addon_${i + 1}`,
      name: o.name.trim(),
      extraPrice: o.extraPrice
    }));

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

  // ── Add-on option management ──────────────────────────────────────────────────

  addAddonOption(): void {
    this.addonOptions.push({ optionId: '', name: '', extraPrice: 0 });
  }

  removeAddonOption(index: number): void {
    this.addonOptions.splice(index, 1);
  }

  /** Clamp addon extra price to non-negative on change */
  onAddonPriceChange(index: number): void {
    if (this.addonOptions[index].extraPrice < 0) {
      this.addonOptions[index].extraPrice = 0;
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

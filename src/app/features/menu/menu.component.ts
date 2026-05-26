import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MenuService, MenuItem, AddOnOption } from '../../core/services/menu.service';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
import { NotificationService } from '../../shared/components/notification/notification.service';
import { ConfigService } from '../../core/services/config.service';
import { FoodCategoryService } from '../../core/services/food-category.service';
import { RestaurantInfoService } from '../../core/services/restaurant-info.service';
import { ShiftEditorComponent } from '../../shared/components/shift-editor/shift-editor.component';
import { ShiftSchedule } from '../../core/models/shift.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, ShiftEditorComponent],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss'
})
export class MenuComponent implements OnInit, OnDestroy {
  selectedCategory = 'all';
  searchQuery = '';
  categoryAvailabilityExpanded = false;
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

  // ── Category OFF confirm state ─────────────────────────────────────────────
  showCategoryOffConfirm = false;
  pendingCategoryOffName: string | null = null;

  // ── Category Shift state ──────────────────────────────────────────────────
  showCategoryShiftModal = false;
  selectedCategoryForShifts: string | null = null;
  categoryShiftTimings: ShiftSchedule[] = [];
  savingCategoryShifts = false;

  // ── Item-level shift editor state ─────────────────────────────────────────
  showItemShiftEditor = false;

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

  // ── Menu mode (driven by route data) ─────────────────────────────────────
  /** 'restaurant' for the regular delivery menu page (/dashboard/menu),
   *  'theater' for the theater menu page (/dashboard/theater/menu). */
  mode: 'restaurant' | 'theater' = 'restaurant';
  /** True when the restaurant has opted into theater (in-venue) ordering. */
  isTheaterEnabled = false;

  get isTheaterMode(): boolean {
    return this.mode === 'theater';
  }

  /** Category options for the form — sourced from food-categories API */
  get formCategories(): string[] {
    return this.foodCategoryService.getCategories();
  }

  get availabilityCategories(): string[] {
    return this.categories.filter(
      category => category !== 'All' && this.hasCategoryItems(category)
    );
  }

  newItem: Partial<MenuItem> & { shiftTimings?: ShiftSchedule[] } = {
    itemName: '',
    category: '',
    subCategory: '',
    restaurantPrice: 0,
    hikePercentage: 0,
    isAvailable: true,
    description: '',
    isVeg: true,
    image: [],
    addOnOptions: [],
    shiftTimings: []
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
    private restaurantInfo: RestaurantInfoService,
    private route: ActivatedRoute,
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

    // Page mode comes from the route's `data: { mode: 'theater' | 'restaurant' }`.
    // Re-subscribing keeps us in sync if the user navigates between the two
    // sibling routes without remounting the component.
    this.route.data.subscribe((data) => {
      const next = (data['mode'] as 'restaurant' | 'theater') || 'restaurant';
      if (next !== this.mode) {
        this.mode = next;
        // Reset filters so a stale "category=Drinks" doesn't carry over to a
        // page where Drinks doesn't exist.
        this.selectedCategory = 'all';
        this.searchQuery = '';
        this.updateCategoryTabs(this.menuItems);
        this.cdr.detectChanges();
      }
    });

    // The Theater Menu route is only reachable for theater-enabled
    // restaurants. We still cache the flag because some downstream logic
    // (e.g. confirming a sidebar regression) wants it.
    this.restaurantInfo.load().subscribe();
    this.restaurantInfo.info$.subscribe(() => {
      this.isTheaterEnabled = this.restaurantInfo.isTheaterEnabled;
      this.cdr.detectChanges();
    });

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
    // Only consider items that belong to the current page mode so the
    // category chips don't list categories that have zero items here.
    const scoped = items.filter(it => this.itemMatchesMode(it));
    const unique = [...new Set(scoped.map(item => item.category).filter(Boolean))].sort();
    this.categories = ['All', ...unique];
  }

  /** True when `item` should appear in the current page (mode-aware). */
  private itemMatchesMode(item: MenuItem): boolean {
    if (this.mode === 'theater') return !!item.theaterMode;
    return !item.theaterMode;
  }

  selectCategory(category: string): void {
    this.selectedCategory = category.toLowerCase();
  }

  toggleCategoryAvailabilityAccordion(): void {
    this.categoryAvailabilityExpanded = !this.categoryAvailabilityExpanded;
  }

  getFilteredItems(): MenuItem[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.menuItems.filter(item => {
      // Mode filter: regular Menu hides theater items; Theater Menu hides
      // non-theater items. The two pages share this component but are wired
      // to different routes with `data: { mode }`.
      if (!this.itemMatchesMode(item)) return false;

      const categoryMatch =
        this.selectedCategory === 'all' || item.category.toLowerCase() === this.selectedCategory;
      if (!categoryMatch) return false;

      if (!query) return true;
      const name = (item.itemName || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const subCategory = (item.subCategory || '').toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        category.includes(query) ||
        subCategory.includes(query)
      );
    });
  }

  hasCategoryItems(category: string): boolean {
    const normalized = category.toLowerCase();
    return this.menuItems.some(item => item.category.toLowerCase() === normalized);
  }

  /** True if ANY item in the category is available — drives the toggle ON state. */
  isCategoryAnyAvailable(category: string): boolean {
    const normalized = category.toLowerCase();
    const categoryItems = this.menuItems.filter(item => item.category.toLowerCase() === normalized);
    if (!categoryItems.length) return false;
    return categoryItems.some(item => item.isAvailable);
  }

  getCategoryOnCount(category: string): number {
    const normalized = category.toLowerCase();
    return this.menuItems.filter(item => item.category.toLowerCase() === normalized && item.isAvailable).length;
  }

  getCategoryTotalCount(category: string): number {
    const normalized = category.toLowerCase();
    return this.menuItems.filter(item => item.category.toLowerCase() === normalized).length;
  }

  /** Called by the category toggle change event. Turning ON is immediate; turning OFF shows a confirm popup. */
  onCategoryToggleChange(category: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    if (!checkbox.checked) {
      // User is trying to turn OFF — revert checkbox and show confirmation
      checkbox.checked = true;
      this.pendingCategoryOffName = category;
      this.showCategoryOffConfirm = true;
      return;
    }
    // Turning ON — enable all immediately
    this.executeCategoryAvailabilityChange(category, true);
  }

  confirmCategoryOff(): void {
    if (this.pendingCategoryOffName) {
      this.executeCategoryAvailabilityChange(this.pendingCategoryOffName, false);
    }
    this.showCategoryOffConfirm = false;
    this.pendingCategoryOffName = null;
  }

  cancelCategoryOff(): void {
    this.showCategoryOffConfirm = false;
    this.pendingCategoryOffName = null;
  }

  private async executeCategoryAvailabilityChange(category: string, shouldEnable: boolean): Promise<void> {
    const normalized = category.toLowerCase();
    const categoryItems = this.menuItems.filter(item => item.category.toLowerCase() === normalized);
    if (!categoryItems.length) return;

    this.loading = true;
    const BATCH_SIZE = 5;
    let failedCount = 0;

    // Process in sequential batches to avoid API throttling (62 items → ~13 batches of 5)
    for (let i = 0; i < categoryItems.length; i += BATCH_SIZE) {
      const batch = categoryItems.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(item => {
          const updatedItemData: Partial<MenuItem> = {
            itemName: item.itemName,
            category: item.category,
            subCategory: item.subCategory,
            restaurantPrice: item.restaurantPrice,
            hikePercentage: item.hikePercentage,
            isVeg: item.isVeg,
            isAvailable: shouldEnable,
            description: item.description,
            image: item.image,
            addOnOptions: item.addOnOptions ?? [],
            shiftTimings: item.shiftTimings ?? []
          };
          // Silent update — no per-item menu refresh; we do one refresh at the end
          return this.menuService.updateMenuItemSilent(item.itemId, updatedItemData).toPromise();
        })
      );
      failedCount += results.filter(r => r.status === 'rejected').length;
    }

    // Single refresh after the entire batch completes
    this.menuService.fetchMenuItems();

    if (failedCount === 0) {
      const statusText = shouldEnable ? 'available' : 'unavailable';
      this.notificationService.success(`${category} items marked as ${statusText}`);
    } else {
      const total = categoryItems.length;
      const succeeded = total - failedCount;
      this.notificationService.error(`${succeeded}/${total} items updated. ${failedCount} failed — please try again.`);
    }
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
        image: item.image,
        addOnOptions: item.addOnOptions ?? [],
        shiftTimings: item.shiftTimings ?? []
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

  /** Flip the theaterMode flag for an item — i.e., move it between the
   *  Restaurant Menu and Theater Menu tabs. */
  toggleTheaterMode(itemId: string): void {
    const item = this.menuItems.find(i => i.itemId === itemId);
    if (!item) return;
    const next = !item.theaterMode;
    this.menuService.updateTheaterMode(itemId, next).subscribe({
      next: () => {
        item.theaterMode = next;
        this.notificationService.success(
          next
            ? `${item.itemName} moved to Theater Menu`
            : `${item.itemName} moved to Restaurant Menu`
        );
        // The active tab's filter will now hide this item — refresh the
        // category chips so empty categories don't linger.
        this.updateCategoryTabs(this.menuItems);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error toggling theaterMode:', err);
        this.notificationService.error('Failed to update theater mode');
      }
    });
  }

  /** Set inventoryCount absolute (e.g. operator typed a fresh number). */
  setInventoryCount(itemId: string, value: number | string): void {
    const next = Math.max(0, Number(value) || 0);
    const item = this.menuItems.find(i => i.itemId === itemId);
    if (!item) return;
    this.menuService.setInventoryCount(itemId, next).subscribe({
      next: () => {
        item.inventoryCount = next;
        this.notificationService.success(`${item.itemName} stock set to ${next}`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error setting inventoryCount:', err);
        this.notificationService.error('Failed to update stock');
      }
    });
  }

  /** Increment stock by a small amount — e.g. "+5" / "+10" restock buttons. */
  restockBy(itemId: string, addBy: number): void {
    const item = this.menuItems.find(i => i.itemId === itemId);
    if (!item) return;
    this.menuService.restockBy(itemId, addBy).subscribe({
      next: () => {
        item.inventoryCount = (item.inventoryCount ?? 0) + addBy;
        this.notificationService.success(`+${addBy} stock for ${item.itemName}`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error restocking:', err);
        this.notificationService.error('Failed to restock');
      }
    });
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

  // ── Category Shift methods ────────────────────────────────────────────────
  openCategoryShiftModal(category: string): void {
    this.selectedCategoryForShifts = category;
    // Pre-populate with any shifts from the first item in the category
    const firstItem = this.menuItems.find(i => i.category.toLowerCase() === category.toLowerCase());
    this.categoryShiftTimings = firstItem?.shiftTimings ? [...firstItem.shiftTimings] : [];
    this.showCategoryShiftModal = true;
  }

  closeCategoryShiftModal(): void {
    this.showCategoryShiftModal = false;
    this.selectedCategoryForShifts = null;
    this.categoryShiftTimings = [];
  }

  onCategoryShiftTimingsChange(shifts: ShiftSchedule[]): void {
    this.categoryShiftTimings = shifts;
  }

  saveCategoryShifts(): void {
    if (!this.selectedCategoryForShifts) return;
    this.savingCategoryShifts = true;
    this.menuService.bulkCategoryShiftTimings(this.selectedCategoryForShifts, this.categoryShiftTimings).subscribe({
      next: (res) => {
        this.notificationService.success(`Shift hours applied to ${this.selectedCategoryForShifts}`);
        this.closeCategoryShiftModal();
        this.savingCategoryShifts = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error saving category shifts:', err);
        this.notificationService.error('Failed to save category shifts');
        this.savingCategoryShifts = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ── Item shift methods ────────────────────────────────────────────────────
  onItemShiftTimingsChange(shifts: ShiftSchedule[]): void {
    this.newItem.shiftTimings = shifts;
  }

  toggleItemShiftEditor(): void {
    this.showItemShiftEditor = !this.showItemShiftEditor;
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
      addOnOptions: item.addOnOptions ? [...item.addOnOptions] : [],
      shiftTimings: item.shiftTimings ? [...item.shiftTimings] : []
    };
    // Mirror addon options into the working array
    this.addonOptions = this.newItem.addOnOptions ? [...this.newItem.addOnOptions] : [];
    // Pre-populate shift editor state
    this.showItemShiftEditor = !!(item.shiftTimings && item.shiftTimings.length > 0);
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
      addOnOptions: [],
      shiftTimings: [],
      // When the operator hits "Add Item" on the Theater Menu page, default
      // the new row to a theater item with zero stock — otherwise they'd
      // create a regular menu item that never shows up in this page.
      theaterMode: this.mode === 'theater' ? true : false,
      inventoryCount: this.mode === 'theater' ? 0 : undefined,
    };
    this.addonOptions = [];
    this.showItemShiftEditor = false;
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

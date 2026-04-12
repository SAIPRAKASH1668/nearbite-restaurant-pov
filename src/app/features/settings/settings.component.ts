import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ImageUploadService } from '../../core/services/image-upload.service';
import { RestaurantContextService } from '../../core/services/restaurant-context.service';
import { RestaurantOnlineService } from '../../core/services/restaurant-online.service';
import { NotificationService } from '../../shared/components/notification/notification.service';

interface PendingFile {
  file: File;
  name: string;
  dataUrl: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit, OnDestroy {

  @ViewChild('thumbsTrack') thumbsTrack?: ElementRef<HTMLElement>;

  // ── Gallery state ──────────────────────────────────────────────────────────
  /** CDN URL strings sourced from the restaurant record's restaurantImage field. */
  galleryImages: string[] = [];
  carouselIndex = 0;
  loadingGallery = false;

  // ── Upload state ───────────────────────────────────────────────────────────
  pendingFiles: PendingFile[] = [];
  uploading = false;
  uploadProgress = 0;
  isDragging = false;

  // ── Lightbox ───────────────────────────────────────────────────────────────
  lightboxOpen = false;

  // ── Operating Hours state ─────────────────────────────────────────────────
  opensAt: string = '';
  closesAt: string = '';
  /** Tracks the last-persisted values — used by template for summary chip and unsaved detection */
  _savedOpensAt: string = '';
  _savedClosesAt: string = '';
  savingHours = false;
  hoursLoaded = false;

  // ── Average Preparation Time ─────────────────────────────────────────────
  avgPreparationTime: number = 25;
  _savedAvgPreparationTime: number = 25;
  savingPrepTime = false;
  prepTimeLoaded = false;
  readonly minPrepTime = 5;
  readonly maxPrepTime = 120;

  // ── In-flight subscription tracking ────────────────────────────────────────
  private galleryLoadSub?: Subscription;

  // ── Touch swipe tracking ───────────────────────────────────────────────────
  private touchStartX = 0;
  private readonly SWIPE_THRESHOLD = 40;
  private readonly MAX_FILE_SIZE_MB = 10;

  constructor(
    private imageUploadService: ImageUploadService,
    private restaurantContext: RestaurantContextService,
    private restaurantOnlineService: RestaurantOnlineService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadGallery();
    this.loadOperatingHours();
    this.loadAvgPreparationTime();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.galleryLoadSub?.unsubscribe();
  }

  // ── Operating Hours ────────────────────────────────────────────────────────

  get hoursUnsaved(): boolean {
    return this.opensAt !== this._savedOpensAt || this.closesAt !== this._savedClosesAt;
  }

  get prepTimeUnsaved(): boolean {
    return this.avgPreparationTime !== this._savedAvgPreparationTime;
  }

  loadOperatingHours(): void {
    this.hoursLoaded = false;
    this.restaurantOnlineService.fetchOperatingHours().subscribe({
      next: ({ opensAt, closesAt }) => {
        this.opensAt        = opensAt;
        this.closesAt       = closesAt;
        this._savedOpensAt  = opensAt;
        this._savedClosesAt = closesAt;
        this.hoursLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => { this.hoursLoaded = true; }
    });
  }

  saveOperatingHours(): void {
    if (this.savingHours) return;
    this.savingHours = true;
    this.restaurantOnlineService
      .updateOperatingHours(this.opensAt, this.closesAt)
      .pipe(finalize(() => { this.savingHours = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this._savedOpensAt  = this.opensAt;
          this._savedClosesAt = this.closesAt;
          this.notificationService.success('Operating hours saved successfully');
        },
        error: () => this.notificationService.error('Failed to save hours. Please try again.')
      });
  }

  resetHours(): void {
    this.opensAt  = this._savedOpensAt;
    this.closesAt = this._savedClosesAt;
  }

  loadAvgPreparationTime(): void {
    this.prepTimeLoaded = false;
    this.restaurantOnlineService.fetchAvgPreparationTime().subscribe({
      next: (minutes) => {
        const normalized = this.normalizePrepTime(minutes ?? 25);
        this.avgPreparationTime = normalized;
        this._savedAvgPreparationTime = normalized;
        this.prepTimeLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.prepTimeLoaded = true;
        this.cdr.markForCheck();
      }
    });
  }

  onPrepTimeInputChange(rawValue: string | number): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    this.avgPreparationTime = this.normalizePrepTime(parsed);
  }

  saveAvgPreparationTime(): void {
    if (this.savingPrepTime) return;
    this.avgPreparationTime = this.normalizePrepTime(this.avgPreparationTime);
    this.savingPrepTime = true;

    this.restaurantOnlineService
      .updateAvgPreparationTime(this.avgPreparationTime)
      .pipe(finalize(() => { this.savingPrepTime = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this._savedAvgPreparationTime = this.avgPreparationTime;
          this.notificationService.success('Average preparation time saved');
        },
        error: () => this.notificationService.error('Failed to save average preparation time')
      });
  }

  resetAvgPreparationTime(): void {
    this.avgPreparationTime = this._savedAvgPreparationTime;
  }

  private normalizePrepTime(value: number): number {
    const rounded = Math.round(value);
    return Math.max(this.minPrepTime, Math.min(this.maxPrepTime, rounded));
  }

  formatDisplayTime(time: string): string {
    if (!time) return '–';
    const [hStr, mStr] = time.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  // ── Keyboard (carousel + lightbox) ────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.lightboxOpen) { this.closeLightbox(); return; }
    if (event.key === 'ArrowLeft')  this.goPrev();
    if (event.key === 'ArrowRight') this.goNext();
  }

  // ── Carousel navigation ────────────────────────────────────────────────────
  goTo(index: number): void {
    this.carouselIndex = Math.max(0, Math.min(index, this.galleryImages.length - 1));
    this.scrollThumbIntoView(this.carouselIndex);
  }

  goPrev(): void { this.goTo(this.carouselIndex - 1); }
  goNext(): void { this.goTo(this.carouselIndex + 1); }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchEnd(event: TouchEvent): void {
    const delta = this.touchStartX - event.changedTouches[0].clientX;
    if (Math.abs(delta) >= this.SWIPE_THRESHOLD) {
      delta > 0 ? this.goNext() : this.goPrev();
    }
  }

  private scrollThumbIntoView(index: number): void {
    if (!this.thumbsTrack) return;
    const track = this.thumbsTrack.nativeElement;
    const thumb = track.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // ── Lightbox ───────────────────────────────────────────────────────────────
  openLightbox(): void {
    this.lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  // ── Gallery load ───────────────────────────────────────────────────────────
  loadGallery(forceRefresh = false): void {
    // Set loading first — before any early exit — so spinner always shows
    this.loadingGallery = true;

    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) {
      this.loadingGallery = false;
      return;
    }

    // Cancel any previous in-flight request
    this.galleryLoadSub?.unsubscribe();

    this.galleryLoadSub = this.imageUploadService
      .getRestaurantImages(restaurantId, forceRefresh)
      .pipe(finalize(() => {
        this.ngZone.run(() => {
          this.loadingGallery = false;
          this.cdr.markForCheck();
        });
      }))
      .subscribe({
        next: (urls) => {
          this.ngZone.run(() => {
            this.galleryImages = urls;
            this.carouselIndex = Math.min(this.carouselIndex, Math.max(0, urls.length - 1));
          });
        },
        error: (err) => {
          console.error('\u274c Failed to load gallery:', err);
          this.notificationService.error('Could not load photos. Please try again.');
        }
      });
  }

  // ── File selection ─────────────────────────────────────────────────────────
  async onFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) await this.addFiles(files);
  }

  private async addFiles(files: File[]): Promise<void> {
    const maxBytes = this.MAX_FILE_SIZE_MB * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxBytes);
    if (oversized.length) {
      this.notificationService.warning(
        `${oversized.length} file(s) exceed ${this.MAX_FILE_SIZE_MB} MB and were skipped`
      );
    }
    const valid = files.filter(f => f.size <= maxBytes);
    if (!valid.length) return;

    const previews = await Promise.all(
      valid.map(async file => ({
        file,
        name: file.name,
        dataUrl: await this.imageUploadService.fileToBase64(file)
      }))
    );
    this.pendingFiles = [...this.pendingFiles, ...previews];
  }

  removePending(index: number): void {
    this.pendingFiles = this.pendingFiles.filter((_, i) => i !== index);
  }

  clearPending(): void {
    this.pendingFiles = [];
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async uploadPending(): Promise<void> {
    if (!this.pendingFiles.length || this.uploading) return;

    const restaurantId = this.restaurantContext.getRestaurantId();
    if (!restaurantId) {
      this.notificationService.error('Restaurant ID not found. Please log in again.');
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;

    const progressInterval = setInterval(() => {
      if (this.uploadProgress < 85) {
        this.uploadProgress += Math.floor(Math.random() * 12) + 4;
      }
    }, 250);

    try {
      const base64List = this.pendingFiles.map(p => p.dataUrl);

      // Step 1: Upload to S3 — get back CDN URLs
      const uploadResponse = await this.imageUploadService
        .uploadRestaurantImages(restaurantId, base64List)
        .toPromise();

      const newUrls = (uploadResponse?.images ?? []).map(img => img.url);

      // Step 2: Merge with existing URLs and persist to restaurant record
      const mergedUrls = [...this.galleryImages, ...newUrls];
      await this.imageUploadService
        .saveRestaurantImages(restaurantId, mergedUrls)
        .toPromise();

      clearInterval(progressInterval);
      this.uploadProgress = 100;

      const count = this.pendingFiles.length;
      this.pendingFiles = [];

      this.notificationService.success(
        `${count} photo${count === 1 ? '' : 's'} uploaded successfully`
      );

      setTimeout(() => {
        this.uploadProgress = 0;
        this.uploading = false;
        // Jump carousel to first new image
        const nextIndex = mergedUrls.length - newUrls.length;
        this.loadGallery();
        setTimeout(() => this.goTo(nextIndex), 100);
      }, 500);

    } catch (err: any) {
      clearInterval(progressInterval);
      this.uploadProgress = 0;
      this.uploading = false;
      console.error('❌ Upload failed:', err);
      this.notificationService.error('Upload failed. Please try again.');
    }
  }
}



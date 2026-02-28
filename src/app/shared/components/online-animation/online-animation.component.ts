import {
  Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RestaurantOnlineService } from '../../../core/services/restaurant-online.service';

@Component({
  selector: 'app-online-animation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './online-animation.component.html',
  styleUrl: './online-animation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OnlineAnimationComponent implements OnInit, OnDestroy {
  visible = false;
  exiting = false;

  /** 24 particles for the starburst */
  particles = Array.from({ length: 24 }, (_, i) => i + 1);
  /** 3 expanding rings */
  rings = [1, 2, 3];
  /** Letters of the hero word */
  liveLetters = ['L', 'I', 'V', 'E', '!'];

  private sub!: Subscription;
  private dismissTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private onlineService: RestaurantOnlineService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.onlineService.animateTrigger$.subscribe(() => this.play());
  }

  play(): void {
    // Reset state cleanly
    this.exiting = false;
    this.visible = true;
    this.cdr.markForCheck();

    clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => {
      this.exiting = true;
      this.cdr.markForCheck();

      setTimeout(() => {
        this.visible = false;
        this.exiting = false;
        this.cdr.markForCheck();
      }, 600);
    }, 3200);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    clearTimeout(this.dismissTimer);
  }
}

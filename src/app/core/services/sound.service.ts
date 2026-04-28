import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private audio: HTMLAudioElement | null = null;
  private pendingAlarm = false;
  private unlocked = false;

  /** Whether the user has muted the current alarm session */
  private mutedSubject = new BehaviorSubject<boolean>(false);
  public muted$ = this.mutedSubject.asObservable();

  /** Whether the alarm is currently ringing (or queued), regardless of mute */
  private ringingSubject = new BehaviorSubject<boolean>(false);
  public ringing$ = this.ringingSubject.asObservable();

  constructor() {
    this.audio = new Audio('assets/sounds/telephone-ring.mp3');
    this.audio.volume = 1.0;
    this.audio.loop = true;   // keep ringing until explicitly stopped
    this.audio.load();

    // Browsers/Electron block audio until first user gesture — unlock on first interaction
    const unlock = () => {
      this.unlocked = true;
      if (this.pendingAlarm) {
        this.pendingAlarm = false;
        this.playNewOrderAlarm();
      }
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  playNewOrderAlarm(): void {
    if (!this.audio) return;
    // A new incoming order always clears the mute so it rings again
    this.mutedSubject.next(false);
    this.ringingSubject.next(true);
    if (!this.unlocked) {
      // Queue the alarm — will fire as soon as the user interacts
      this.pendingAlarm = true;
      return;
    }
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.warn('SoundService: could not play alarm', e));
  }

  /**
   * Mute the current ringing session without stopping the "ringing" state.
   * The next genuinely new order will unmute and ring again automatically.
   */
  muteAlarm(): void {
    this.pendingAlarm = false;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.mutedSubject.next(true);
    // ringingSubject stays true so the bell icon stays visible until orders are handled
  }

  stopAlarm(): void {
    this.pendingAlarm = false;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.mutedSubject.next(false);
    this.ringingSubject.next(false);
  }

  /** True when the alarm is actively looping or queued to play on next user gesture */
  isAlarmPlaying(): boolean {
    return this.pendingAlarm || (!!this.audio && !this.audio.paused);
  }

  /** True when there are unacknowledged orders (ringing OR muted-but-pending) */
  isRinging(): boolean {
    return this.ringingSubject.value;
  }
}



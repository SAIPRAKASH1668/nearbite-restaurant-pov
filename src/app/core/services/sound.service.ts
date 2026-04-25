import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private audio: HTMLAudioElement | null = null;
  private pendingAlarm = false;
  private unlocked = false;

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
    if (!this.unlocked) {
      // Queue the alarm — will fire as soon as the user interacts
      this.pendingAlarm = true;
      return;
    }
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.warn('SoundService: could not play alarm', e));
  }

  stopAlarm(): void {
    this.pendingAlarm = false;
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}



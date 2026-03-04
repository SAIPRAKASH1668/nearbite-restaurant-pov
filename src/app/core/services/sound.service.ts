import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private audio: HTMLAudioElement | null = null;

  constructor() {
    this.audio = new Audio('assets/sounds/telephone-ring.mp3');
    this.audio.volume = 1.0;
    this.audio.loop = true;   // keep ringing until explicitly stopped
    this.audio.load();
  }

  playNewOrderAlarm(): void {
    if (!this.audio) return;
    this.audio.currentTime = 0;
    this.audio.play().catch(e => console.warn('SoundService: could not play alarm', e));
  }

  stopAlarm(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}



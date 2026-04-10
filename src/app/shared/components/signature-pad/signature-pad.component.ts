import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Output,
  EventEmitter,
  Input,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sig-wrapper" [class.sig-signed]="signed">
      <canvas
        #sigCanvas
        class="sig-canvas"
        [width]="canvasWidth"
        [height]="canvasHeight"
      ></canvas>
      <div class="sig-actions" *ngIf="!signed">
        <button type="button" class="sig-btn sig-clear" (click)="clear()">Clear</button>
      </div>
      <div class="sig-badge" *ngIf="signed">Signed</div>
    </div>
  `,
  styles: [`
    .sig-wrapper {
      position: relative;
      border: 2px dashed #ccc;
      border-radius: 8px;
      background: #fafafa;
      overflow: hidden;
      transition: border-color 0.2s;
    }
    .sig-wrapper:hover { border-color: #aaa; }
    .sig-wrapper.sig-signed {
      border-color: #22c55e;
      border-style: solid;
    }
    .sig-canvas {
      display: block;
      width: 100%;
      cursor: crosshair;
      touch-action: none;
    }
    .sig-actions {
      display: flex;
      justify-content: flex-end;
      padding: 4px 8px;
      gap: 8px;
      background: #f5f5f5;
    }
    .sig-btn {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;
      transition: background 0.15s;
    }
    .sig-btn:hover { background: #eee; }
    .sig-clear { color: #e74c3c; border-color: #e74c3c33; }
    .sig-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #22c55e;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 2px 8px;
    }
  `],
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sigCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() canvasWidth = 300;
  @Input() canvasHeight = 120;
  @Output() signatureChange = new EventEmitter<string | null>();

  private sigPad!: SignaturePad;
  signed = false;

  ngAfterViewInit(): void {
    this.sigPad = new SignaturePad(this.canvasRef.nativeElement, {
      minWidth: 0.8,
      maxWidth: 2.5,
      penColor: '#1a1a2e',
      backgroundColor: 'rgba(0,0,0,0)',
    });

    this.sigPad.addEventListener('endStroke', () => {
      this.signed = !this.sigPad.isEmpty();
      this.emitData();
    });

    this.resizeCanvas();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const wrapper = canvas.parentElement;
    if (!wrapper) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = wrapper.clientWidth;
    const height = this.canvasHeight;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.getContext('2d')!.scale(ratio, ratio);

    this.sigPad.clear();
    this.signed = false;
    this.emitData();
  }

  clear(): void {
    this.sigPad.clear();
    this.signed = false;
    this.emitData();
  }

  isEmpty(): boolean {
    return this.sigPad?.isEmpty() ?? true;
  }

  toDataURL(): string {
    return this.sigPad.toDataURL('image/png');
  }

  private emitData(): void {
    this.signatureChange.emit(this.signed ? this.toDataURL() : null);
  }

  ngOnDestroy(): void {
    this.sigPad?.off();
  }
}

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'orderIdHighlight',
  standalone: true,
})
export class OrderIdHighlightPipe implements PipeTransform {
  transform(orderId: string | null | undefined): { prefix: string; suffix: string } {
    const value = (orderId || '').trim();
    if (!value) {
      return { prefix: '', suffix: '' };
    }

    if (value.length <= 4) {
      return { prefix: '', suffix: value };
    }

    return {
      prefix: value.slice(0, -4),
      suffix: value.slice(-4),
    };
  }
}

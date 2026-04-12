import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SettlementOrderRow {
  orderId        : string;
  date           : string;
  createdAt      : string;
  grandTotal     : number;
  foodTotal      : number;
  deliveryFee    : number;
  platformFee    : number;
  paymentMethod  : string;
  restaurantName : string;
  foodCommission : number;
  couponDeduction: number;
  netPayout      : number;
}

export interface SettlementPreview {
  restaurantId         : string;
  restaurantName       : string;
  startDate            : string;
  endDate              : string;
  totalOrders          : number;
  totalGMV             : number;
  totalCommission      : number;
  totalCouponDeduction : number;
  netPayable           : number;
  orders               : SettlementOrderRow[];
}

export interface SettlementConfirmResponse extends SettlementPreview {
  settlementId    : string;
  settledOrderIds : string[];
  reportBase64    : string;
  filename        : string;
}

@Injectable({ providedIn: 'root' })
export class SettlementService {
  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** GET – preview unsettled orders for a date range (no side effects) */
  previewSettlement(
    restaurantId: string,
    startDate   : string,
    endDate     : string,
  ): Observable<SettlementPreview> {
    return this.http.get<SettlementPreview>(
      `${this.API}/restaurants/${restaurantId}/earnings/settlement/preview`,
      { params: { startDate, endDate } },
    );
  }

  /** POST – confirm settlement, returns JSON with base64 XLSX report */
  confirmSettlement(
    restaurantId   : string,
    startDate      : string,
    endDate        : string,
    restaurantName : string,
  ): Observable<SettlementConfirmResponse> {
    return this.http.post<SettlementConfirmResponse>(
      `${this.API}/restaurants/${restaurantId}/earnings/settlement/confirm`,

      { startDate, endDate, restaurantName },
    );
  }

  /** Decode a base64 XLSX string and trigger a browser download */
  downloadReport(base64: string, filename: string): void {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob(
      [bytes],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    );
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

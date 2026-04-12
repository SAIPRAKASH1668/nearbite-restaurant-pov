import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { jsPDF } from 'jspdf';
import { SignaturePadComponent } from '../../shared/components/signature-pad/signature-pad.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, FormsModule, SignaturePadComponent],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {
  @ViewChild('platformSig') platformSig!: SignaturePadComponent;
  @ViewChild('restaurantSig') restaurantSig!: SignaturePadComponent;

  platformDate = '';
  platformSignature: string | null = null;
  restaurantSignature: string | null = null;

  restaurant = {
    name: '',
    owner: '',
    gstin: '',
    fssai: '',
    fssaiValidDate: '',
    pan: '',
    entityType: '',
    address: '',
    phone: '',
    email: '',
    commission: '',
    date: '',
  };

  bank = {
    holderName: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    branchName: '',
    upiId: '',
  };

  constructor(private router: Router) {}

  navigateHome(): void {
    this.router.navigate(['/']);
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  canDownload(): boolean {
    const r = this.restaurant;
    const b = this.bank;
    return !!(
      r.name &&
      r.owner &&
      r.gstin &&
      r.fssai &&
      r.fssaiValidDate &&
      r.pan &&
      r.entityType &&
      r.address &&
      r.phone &&
      r.email &&
      r.commission &&
      r.date &&
      b.holderName &&
      b.bankName &&
      b.accountNumber &&
      b.ifsc &&
      b.branchName &&
      this.platformDate &&
      this.platformSignature &&
      this.restaurantSignature
    );
  }

  downloadSignedPdf(): void {
    if (!this.canDownload()) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const addText = (
      text: string,
      size: number,
      style: 'normal' | 'bold' = 'normal',
      align: 'left' | 'center' = 'left',
      maxWidth?: number
    ): void => {
      pdf.setFontSize(size);
      pdf.setFont('helvetica', style);
      const w = maxWidth ?? contentWidth;
      const lines = pdf.splitTextToSize(text, w);
      if (y + lines.length * size * 0.45 > pdf.internal.pageSize.getHeight() - 15) {
        pdf.addPage();
        y = 20;
      }
      if (align === 'center') {
        for (const line of lines) {
          const lw = pdf.getTextWidth(line);
          pdf.text(line, (pageWidth - lw) / 2, y);
          y += size * 0.45;
        }
      } else {
        pdf.text(lines, margin, y);
        y += lines.length * size * 0.45;
      }
    };

    const addLine = (): void => {
      pdf.setDrawColor(200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;
    };

    const addRow = (label: string, value: string, labelWidth = 55): void => {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin + 2, y);
      pdf.setFont('helvetica', 'normal');
      const valLines = pdf.splitTextToSize(value, contentWidth - labelWidth - 4);
      pdf.text(valLines, margin + labelWidth, y);
      y += Math.max(valLines.length * 4.5, 5.5);
    };

    // Title
    addText('RESTAURANT PARTNER ENROLMENT FORM', 16, 'bold', 'center');
    y += 2;
    addText('Food Ordering and Delivery Services', 10, 'normal', 'center');
    y += 6;
    addLine();
    y += 2;

    // Platform details
    addText('PLATFORM DETAILS', 11, 'bold');
    y += 3;
    addRow('Platform Name:', 'YumDude');
    addRow('Legal Entity:', 'YumDude (Proprietorship)');
    addRow('Owner / Signatory:', 'Thanikanti Subbarayudu');
    addRow('GSTIN:', '37CSTPS9728N1ZA');
    addRow('Date:', this.formatDate(this.platformDate));
    y += 6;

    // Restaurant details
    addText('RESTAURANT PARTNER DETAILS', 11, 'bold');
    y += 3;
    addRow('Restaurant Name:', this.restaurant.name);
    addRow('Owner / Signatory:', this.restaurant.owner);
    addRow('Type of Entity:', this.restaurant.entityType);
    addRow('GSTIN:', this.restaurant.gstin);
    addRow('PAN Number:', this.restaurant.pan);
    addRow('FSSAI License No.:', this.restaurant.fssai);
    addRow('FSSAI Valid Till:', this.formatDate(this.restaurant.fssaiValidDate));
    addRow('Address:', this.restaurant.address);
    addRow('Contact Number:', this.restaurant.phone);
    addRow('Email:', this.restaurant.email);
    addRow('Agreed Commission:', this.restaurant.commission);
    addRow('Date:', this.formatDate(this.restaurant.date));
    y += 6;

    // Bank details
    addText('BANK DETAILS (FOR PAYMENT SETTLEMENT)', 11, 'bold');
    y += 3;
    addRow('Account Holder Name:', this.bank.holderName);
    addRow('Bank Name:', this.bank.bankName);
    addRow('Account Number:', this.bank.accountNumber);
    addRow('IFSC Code:', this.bank.ifsc);
    addRow('Branch Name:', this.bank.branchName);
    addRow('UPI ID:', this.bank.upiId || 'N/A');
    y += 8;
    addLine();
    y += 4;

    // Terms content — render from DOM
    const termsBody = document.querySelector('.terms-body');
    if (termsBody) {
      const sections = this.extractTermsText(termsBody);
      for (const section of sections) {
        if (section.type === 'heading') {
          y += 3;
          addText(section.text, 11, 'bold');
          y += 2;
        } else if (section.type === 'subheading') {
          y += 2;
          addText(section.text, 10, 'bold');
          y += 1;
        } else {
          addText(section.text, 9);
          y += 1;
        }
      }
    }

    // Signature page
    pdf.addPage();
    y = 30;
    addText('SIGNATURES', 14, 'bold', 'center');
    y += 4;
    addText(
      'Both parties hereby confirm that they have read, understood, and agree to be bound by the Terms and Conditions set out in this Agreement.',
      9,
      'normal',
      'center'
    );
    y += 12;

    const sigWidth = 60;
    const sigHeight = 25;
    const leftX = margin;
    const rightX = pageWidth / 2 + 8;

    // Platform signature block
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('For YumDude', leftX, y);
    pdf.text('For Restaurant Partner', rightX, y);
    y += 8;

    if (this.platformSignature) {
      pdf.addImage(this.platformSignature, 'PNG', leftX, y, sigWidth, sigHeight);
    }
    if (this.restaurantSignature) {
      pdf.addImage(this.restaurantSignature, 'PNG', rightX, y, sigWidth, sigHeight);
    }
    y += sigHeight + 4;

    pdf.setDrawColor(100);
    pdf.line(leftX, y, leftX + sigWidth, y);
    pdf.line(rightX, y, rightX + sigWidth, y);
    y += 5;

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Thanikanti Subbarayudu', leftX, y);
    pdf.text(this.restaurant.owner, rightX, y);
    y += 4;
    pdf.text('Proprietor, YumDude', leftX, y);
    pdf.text(this.restaurant.name, rightX, y);
    y += 4;
    pdf.text(`Date: ${this.formatDate(this.platformDate)}`, leftX, y);
    pdf.text(`Date: ${this.formatDate(this.restaurant.date)}`, rightX, y);

    // Footer on last page
    y = pdf.internal.pageSize.getHeight() - 15;
    pdf.setFontSize(7);
    pdf.setTextColor(150);
    pdf.text(
      `Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      pageWidth / 2,
      y,
      { align: 'center' }
    );

    const fileName = `YumDude_Agreement_${this.restaurant.name.replace(/\s+/g, '_')}.pdf`;
    pdf.save(fileName);
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private extractTermsText(
    el: Element
  ): { type: 'heading' | 'subheading' | 'paragraph'; text: string }[] {
    const result: { type: 'heading' | 'subheading' | 'paragraph'; text: string }[] = [];

    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      const text = (child.textContent || '').trim();
      if (!text) continue;

      if (tag === 'h2') {
        result.push({ type: 'heading', text });
      } else if (tag === 'h3') {
        result.push({ type: 'subheading', text });
      } else if (tag === 'p') {
        result.push({ type: 'paragraph', text });
      } else if (tag === 'ol' || tag === 'ul') {
        for (const li of Array.from(child.children)) {
          const liText = (li.textContent || '').trim();
          if (liText) {
            result.push({ type: 'paragraph', text: `• ${liText}` });
          }
        }
      }
    }

    return result;
  }
}

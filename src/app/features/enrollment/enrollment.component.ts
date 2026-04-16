import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  ImageRun,
  convertInchesToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import { SignaturePadComponent } from '../../shared/components/signature-pad/signature-pad.component';

@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [CommonModule, FormsModule, SignaturePadComponent],
  templateUrl: './enrollment.component.html',
  styleUrl: './enrollment.component.scss',
})
export class EnrollmentComponent {
  @ViewChild('restaurantSig') restaurantSig!: SignaturePadComponent;
  @ViewChild('platformSig') platformSig!: SignaturePadComponent;

  restaurantSignature: string | null = null;
  platformSignature: string | null = null;
  platformDate = '';

  restaurant = {
    name: '',
    owner: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    city: 'Nandyal',
    pincode: '518502',
  };

  legal = {
    fssai: '',
    fssaiValid: '',
    gstin: '',
    pan: '',
    entityType: '',
  };

  bank = {
    holderName: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    branch: '',
    upiId: '',
  };

  commission = '';

  declaration = {
    signatoryName: '',
    designation: '',
    date: '',
    place: 'Nandyal',
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
    const l = this.legal;
    const b = this.bank;
    const d = this.declaration;
    return !!(
      r.name && r.owner && r.phone && r.email && r.address &&
      l.fssai && l.fssaiValid && l.gstin && l.pan && l.entityType &&
      b.holderName && b.bankName && b.accountNumber && b.ifsc &&
      this.commission &&
      d.signatoryName && d.designation && d.date &&
      this.platformDate &&
      this.restaurantSignature &&
      this.platformSignature
    );
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private sectionHeader(text: string): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: 100, type: WidthType.PERCENTAGE },
          shading: { fill: 'FFC107', type: ShadingType.CLEAR, color: 'auto' },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text, bold: true, size: 22, font: 'Calibri' })],
            }),
          ],
        }),
      ],
    });
  }

  private fieldRow(label: string, value: string): TableRow {
    const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const bottomBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
    const borders = { top: noBorder, left: noBorder, right: noBorder, bottom: bottomBorder };

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          borders,
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders,
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: value || '_______________', size: 20, font: 'Calibri', color: value ? '000000' : 'AAAAAA' })],
            }),
          ],
        }),
      ],
    });
  }

  async downloadDocx(): Promise<void> {

    const r = this.restaurant;
    const l = this.legal;
    const b = this.bank;
    const d = this.declaration;

    const doc = new DocxDocument({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(0.8),
                bottom: convertInchesToTwip(0.8),
                left: convertInchesToTwip(0.9),
                right: convertInchesToTwip(0.9),
              },
            },
          },
          children: [
            // Title
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 80 },
              children: [new TextRun({ text: 'YumDude', bold: true, size: 36, font: 'Calibri', color: 'D32F2F' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [new TextRun({ text: 'Restaurant Partner Enrollment Form', bold: true, size: 28, font: 'Calibri' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: "Nandyal's Own Food Delivery App  |  yumdudeapp@gmail.com  |  yumdude.com", size: 18, font: 'Calibri', color: '666666' })],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: 'Please fill all the fields clearly. Fields marked * are mandatory.', italics: true, size: 18, font: 'Calibri', color: '888888' })],
            }),

            // Section 1: Restaurant Details
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                this.sectionHeader('SECTION 1 — RESTAURANT DETAILS'),
                this.fieldRow('Restaurant Name *', r.name),
                this.fieldRow('Owner / Proprietor Name *', r.owner),
                this.fieldRow('Contact Number *', r.phone),
                this.fieldRow('Alternate Contact Number', r.altPhone),
                this.fieldRow('Email Address *', r.email),
                this.fieldRow('Restaurant Address *', r.address),
                this.fieldRow('City', r.city),
                this.fieldRow('Pincode *', r.pincode),
              ],
            }),

            new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

            // Section 2: Legal & Compliance
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                this.sectionHeader('SECTION 2 — LEGAL & COMPLIANCE'),
                this.fieldRow('FSSAI License Number *', l.fssai),
                this.fieldRow('FSSAI License Valid Until *', this.formatDate(l.fssaiValid)),
                this.fieldRow('GST Number *', l.gstin),
                this.fieldRow('PAN/TAN Number *', l.pan),
                this.fieldRow('Type of Entity *', l.entityType),
              ],
            }),

            new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

            // Section 3: Bank Details
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                this.sectionHeader('SECTION 3 — BANK DETAILS (FOR SETTLEMENT)'),
                this.fieldRow('Account Holder Name *', b.holderName),
                this.fieldRow('Bank Name *', b.bankName),
                this.fieldRow('Account Number *', b.accountNumber),
                this.fieldRow('IFSC Code *', b.ifsc),
                this.fieldRow('Branch Name', b.branch),
                this.fieldRow('UPI ID', b.upiId || 'N/A'),
              ],
            }),

            new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),

            // Section 4: Commission Agreement
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [this.sectionHeader('SECTION 4 — COMMISSION AGREEMENT')],
            }),
            new Paragraph({
              spacing: { before: 120, after: 80 },
              children: [
                new TextRun({ text: 'Agreed Commission Rate:   ', size: 20, font: 'Calibri' }),
                new TextRun({ text: `${this.commission}%`, bold: true, size: 22, font: 'Calibri' }),
                new TextRun({ text: '   per order (inclusive of 18% GST and 2% payment gateway charges)', size: 20, font: 'Calibri' }),
              ],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: 'This rate has been mutually agreed between YumDude and the Restaurant Partner. No additional charges apply beyond this rate.', size: 18, font: 'Calibri', color: '555555' })],
            }),

            // Section 5: Declaration & Acceptance
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [this.sectionHeader('SECTION 5 — DECLARATION & ACCEPTANCE')],
            }),
            new Paragraph({
              spacing: { before: 120, after: 160 },
              children: [new TextRun({ text: 'I / We confirm that the information provided above is accurate and complete. I / We agree to abide by the YumDude Restaurant Partner Terms & Conditions attached to this form.', size: 20, font: 'Calibri' })],
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                this.fieldRow('Authorised Signatory Name *', d.signatoryName),
                this.fieldRow('Designation *', d.designation),
                this.fieldRow('Date *', this.formatDate(d.date)),
                this.fieldRow('Place *', d.place),
              ],
            }),

            new Paragraph({ spacing: { before: 300, after: 0 }, children: [] }),

            // Signature boxes with embedded signature images
            ...this.buildSignatureTable(),

            new Paragraph({
              spacing: { before: 120, after: 0 },
              children: [new TextRun({ text: 'For YumDude use only — Enrollment ID: ________________   Approved By: ________________   Date: ________________', size: 16, font: 'Calibri', color: '999999', italics: true })],
            }),

            // Page break before T&C
            new Paragraph({ pageBreakBefore: true, children: [] }),

            // T&C Header
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [new TextRun({ text: 'YumDude', bold: true, size: 28, font: 'Calibri', color: 'D32F2F' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [new TextRun({ text: 'Restaurant Partner — Terms & Conditions', bold: true, size: 24, font: 'Calibri' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [new TextRun({ text: 'Effective from the date of enrollment. Please read carefully before signing.', size: 18, font: 'Calibri', color: '666666', italics: true })],
            }),

            // Acceptance box
            ...this.termsAcceptanceBox(),

            // T&C sections
            ...this.termsContent(),

            // Footer
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [new TextRun({ text: 'YumDude  ·  Nandyal\'s Own Food App  ·  yumdudeapp@gmail.com  ·  yumdude.com', size: 16, font: 'Calibri', color: '999999' })],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = r.name
      ? `YumDude_Enrollment_${r.name.replace(/\s+/g, '_')}.docx`
      : 'YumDude_Restaurant_Enrollment.docx';
    saveAs(blob, fileName);
  }

  private termsAcceptanceBox(): Paragraph[] {
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: { fill: 'FFF8E1', type: ShadingType.CLEAR, color: 'auto' },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: 'FFC107' },
                  left: { style: BorderStyle.SINGLE, size: 2, color: 'FFC107' },
                  right: { style: BorderStyle.SINGLE, size: 2, color: 'FFC107' },
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: 'FFC107' },
                },
                children: [
                  new Paragraph({
                    spacing: { before: 80, after: 40 },
                    children: [new TextRun({ text: 'ACCEPTANCE OF TERMS', bold: true, size: 20, font: 'Calibri' })],
                  }),
                  new Paragraph({
                    spacing: { after: 80 },
                    children: [new TextRun({ text: 'By signing the Enrollment Form, the Restaurant Partner confirms that they have read, understood, and agreed to all terms and conditions in this document.', size: 18, font: 'Calibri' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),
    ] as any[];
  }

  private dataUrlToBuffer(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private buildSignatureTable(): (Table | Paragraph)[] {
    const sigBorder = {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' as const },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' as const },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' as const },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' as const },
    };

    const restChildren: Paragraph[] = [
      new Paragraph({
        spacing: { before: 60 },
        children: [new TextRun({ text: 'Restaurant Partner Signature & Stamp', bold: true, size: 18, font: 'Calibri' })],
      }),
    ];
    if (this.restaurantSignature) {
      restChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [
            new ImageRun({
              data: this.dataUrlToBuffer(this.restaurantSignature),
              transformation: { width: 200, height: 80 },
              type: 'png',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: this.declaration.signatoryName, size: 18, font: 'Calibri' })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `Date: ${this.formatDate(this.declaration.date)}`, size: 16, font: 'Calibri', color: '666666' })],
        }),
      );
    } else {
      restChildren.push(new Paragraph({ spacing: { before: 600, after: 60 }, children: [] }));
    }

    const platChildren: Paragraph[] = [
      new Paragraph({
        spacing: { before: 60 },
        children: [new TextRun({ text: 'YumDude Authorised Signature', bold: true, size: 18, font: 'Calibri' })],
      }),
    ];
    if (this.platformSignature) {
      platChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 60 },
          children: [
            new ImageRun({
              data: this.dataUrlToBuffer(this.platformSignature),
              transformation: { width: 200, height: 80 },
              type: 'png',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [new TextRun({ text: 'Thanikanti Subbarayudu', size: 18, font: 'Calibri' })],
        }),
        new Paragraph({
          children: [new TextRun({ text: `Date: ${this.formatDate(this.platformDate)}`, size: 16, font: 'Calibri', color: '666666' })],
        }),
      );
    } else {
      platChildren.push(new Paragraph({ spacing: { before: 600, after: 60 }, children: [] }));
    }

    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: sigBorder,
                children: restChildren,
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: sigBorder,
                children: platChildren,
              }),
            ],
          }),
        ],
      }),
    ];
  }

  private tcHeading(text: string): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text, bold: true, size: 22, font: 'Calibri' })],
    });
  }

  private tcPara(text: string): Paragraph {
    return new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text, size: 19, font: 'Calibri', color: '444444' })],
    });
  }

  private tcBullet(text: string): Paragraph {
    return new Paragraph({
      spacing: { after: 60 },
      indent: { left: convertInchesToTwip(0.3) },
      children: [new TextRun({ text: `•  ${text}`, size: 19, font: 'Calibri', color: '444444' })],
    });
  }

  private termsContent(): Paragraph[] {
    return [
      this.tcHeading('1.  About YumDude'),
      this.tcPara('YumDude is a food delivery platform built exclusively for Nandyal. We connect local restaurants with customers and handle delivery. By enrolling, you agree to these terms.'),

      this.tcHeading('2.  Commission & Pricing'),
      this.tcPara('The commission agreed at enrollment is all-inclusive and covers:'),
      this.tcBullet('18% GST on the platform service'),
      this.tcBullet('2% payment gateway / transaction charges'),
      this.tcPara('No extra charges will be levied. The restaurant must not charge customers more than the prices listed on YumDude.'),

      this.tcHeading('3.  Settlement of Payments'),
      this.tcPara('YumDude will settle payments as follows:'),
      this.tcBullet('First 2 weeks after enrollment: Daily settlements (next business day)'),
      this.tcBullet('After the first 2 weeks: Every Monday, for all orders completed the previous week (Monday to Sunday)'),
      this.tcPara('Settlements are made via bank transfer or UPI to the details provided at enrollment. Discrepancies must be reported within 3 days of receiving the settlement statement.'),

      this.tcHeading('4.  What the Restaurant is Responsible For'),
      this.tcPara('The restaurant is solely responsible for:'),
      this.tcBullet('Missing items — any ordered item not present in unzipped package (zip tie/cello tape seal is mandatory)'),
      this.tcBullet('Incorrect items — wrong dish, variant, or quantity'),
      this.tcBullet('Food quality — stale, undercooked, overcooked, or spoiled food'),
      this.tcBullet('Food safety & hygiene — maintaining a valid FSSAI license and clean kitchen standards'),
      this.tcBullet('Packaging — ensuring food is packed well to minimise spillage risk'),
      this.tcBullet('Preparation time — keeping prep time within reasonable limits and updating in the app'),
      this.tcPara('If a customer complaint is found to be the restaurant\'s fault, the refund cost will be adjusted from the next settlement.'),

      this.tcHeading('5.  What YumDude is Responsible For'),
      this.tcPara('YumDude takes responsibility for:'),
      this.tcBullet('Food spillage during delivery caused by our delivery partner\'s mishandling'),
      this.tcBullet('Significant delivery delays caused by our delivery network (not by late food preparation)'),
      this.tcBullet('Orders not reaching the customer due to delivery partner error'),
      this.tcPara('In such cases, YumDude will handle the customer resolution at its own cost. YumDude is not responsible for food quality, taste, or packaging.'),

      this.tcHeading('6.  Menu & Availability'),
      this.tcPara('The restaurant must keep its menu on the platform accurate and updated at all times.'),
      this.tcPara('Unavailable items must be marked out of stock immediately to avoid complaints.'),
      this.tcPara('YumDude may temporarily hide restaurants that consistently fail to fulfil orders.'),

      this.tcHeading('7.  Order Acceptance'),
      this.tcPara('Once an order is accepted, the restaurant must fulfill it. Repeated post-acceptance cancellations may lead to suspension.'),
      this.tcPara('If the restaurant is closed or unable to take orders, it must mark itself as closed on the app in advance.'),

      this.tcHeading('8.  Ratings & Quality'),
      this.tcPara('Customers can rate their experience. Restaurants with a consistent rating below 3.0 for more than 30 days may be reviewed. Continued low ratings may result in removal from the platform.'),

      this.tcHeading('9.  Termination of Partnership'),
      this.tcPara('Either party may end this partnership with 14 days\' written notice. YumDude may immediately suspend a restaurant without notice if:'),
      this.tcBullet('There is a serious food safety violation'),
      this.tcBullet('The FSSAI license has expired or been revoked'),
      this.tcBullet('There is fraud, order manipulation, or misuse of the platform'),

      this.tcHeading('10.  Confidentiality'),
      this.tcPara('Both parties agree to keep the agreed commission rate and any shared business data confidential and not disclose it to third parties.'),

      this.tcHeading('11.  Governing Law'),
      this.tcPara('This agreement is governed by the laws of India. Any disputes will first be resolved amicably. If unresolved, jurisdiction shall be Nandyal, Andhra Pradesh.'),

      this.tcHeading('12.  Changes to These Terms'),
      this.tcPara('YumDude may update these terms from time to time with at least 7 days\' advance notice to restaurant partners. Continued use of the platform implies acceptance of the updated terms.'),
    ];
  }
}

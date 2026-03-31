import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ExportFileOptions {
  mimeType: string;
  fileName: string;
  title?: string;
  dialogTitle?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileExportService {
  async exportTextFile(content: string, options: ExportFileOptions): Promise<void> {
    const blob = new Blob([content], { type: options.mimeType });
    await this.exportBlob(blob, options);
  }

  async exportBlob(blob: Blob, options: ExportFileOptions): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.downloadInBrowser(blob, options.fileName);
      return;
    }

    const canShare = await Share.canShare();
    if (!canShare.value) {
      throw new Error('File sharing is not available on this device.');
    }

    const result = await Filesystem.writeFile({
      path: `exports/${Date.now()}-${this.sanitizeFileName(options.fileName)}`,
      data: await this.blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true
    });

    await Share.share({
      title: options.title || options.fileName,
      dialogTitle: options.dialogTitle || options.title || options.fileName,
      files: [result.uri]
    });
  }

  private downloadInBrowser(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(reader.error || new Error('Failed to read export file.'));
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Unexpected file reader result.'));
          return;
        }

        resolve(reader.result.split(',')[1] || '');
      };

      reader.readAsDataURL(blob);
    });
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^\w.-]/g, '_');
  }
}

import { Injectable, signal } from '@angular/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { environment } from '../../../environments/environment';

interface AppUpdaterPlugin {
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
  fetchManifest(options: { manifestUrl: string }): Promise<{ json: string }>;
  canRequestPackageInstalls(): Promise<{ allowed: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: { apkUrl: string; sha256: string }): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (progress: { bytesRead: number; contentLength: number; percent: number }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

interface AndroidUpdateManifest {
  android?: {
    versionCode?: number;
    versionName?: string;
    minRequiredVersionCode?: number;
    apkUrl?: string;
    sha256?: string;
    releaseNotes?: string;
  };
}

type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'required'
  | 'permission-required'
  | 'downloading'
  | 'installing'
  | 'up-to-date'
  | 'error';

export interface AppUpdateState {
  status: AppUpdateStatus;
  currentVersionCode?: number;
  currentVersionName?: string;
  targetVersionCode?: number;
  targetVersionName?: string;
  releaseNotes?: string;
  progressPercent?: number;
  message?: string;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  readonly state = signal<AppUpdateState>({ status: 'idle' });

  private readonly manifestUrl = environment.androidUpdateManifestUrl;
  private requiredUpdate?: Required<Pick<NonNullable<AndroidUpdateManifest['android']>, 'apkUrl' | 'sha256'>> &
    NonNullable<AndroidUpdateManifest['android']>;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android' || !this.manifestUrl) {
      return;
    }

    try {
      const progressListener = await AppUpdater.addListener('downloadProgress', (progress) => {
        const current = this.state();
        if (current.status !== 'downloading') {
          return;
        }
        this.state.set({
          ...current,
          progressPercent: progress.percent >= 0 ? progress.percent : undefined
        });
      });

      window.addEventListener('beforeunload', () => {
        progressListener.remove().catch(() => undefined);
      });
    } catch {
      // Progress events are helpful, but update checks should not depend on them.
    }

    await this.checkForRequiredUpdate();

    void CapacitorApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        void this.checkForRequiredUpdate({ silent: true });
      }
    });
  }

  async checkForRequiredUpdate(options?: { silent?: boolean }): Promise<void> {
    if (!this.manifestUrl) {
      return;
    }

    const current = this.state();
    if (current.status === 'downloading' || current.status === 'installing') {
      return;
    }

    if (!options?.silent) {
      this.state.set({ status: 'checking' });
    }

    try {
      const [version, manifest] = await Promise.all([AppUpdater.getVersion(), this.fetchManifest()]);
      const update = this.normalizeManifest(manifest);
      const minRequiredVersionCode = update?.minRequiredVersionCode ?? update?.versionCode ?? 0;

      if (!update || version.versionCode >= minRequiredVersionCode) {
        this.requiredUpdate = undefined;
        this.state.set({
          status: 'up-to-date',
          currentVersionCode: version.versionCode,
          currentVersionName: version.versionName
        });
        return;
      }

      this.requiredUpdate = update;
      this.state.set({
        status: 'required',
        currentVersionCode: version.versionCode,
        currentVersionName: version.versionName,
        targetVersionCode: update.versionCode,
        targetVersionName: update.versionName,
        releaseNotes: update.releaseNotes,
        message: 'A required YumDude Partner update is available.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not check for app updates.';
      console.warn('[app-update] Update check failed', error);
      if (this.requiredUpdate) {
        this.state.set({
          ...this.state(),
          status: 'error',
          message
        });
      } else {
        this.state.set({ status: 'idle' });
      }
    }
  }

  async startRequiredUpdate(): Promise<void> {
    if (!this.requiredUpdate) {
      await this.checkForRequiredUpdate();
      if (!this.requiredUpdate) {
        return;
      }
    }

    const permission = await AppUpdater.canRequestPackageInstalls();
    if (!permission.allowed) {
      this.state.set({
        ...this.state(),
        status: 'permission-required',
        message: 'Allow YumDude Partner to install this required update.'
      });
      return;
    }

    this.state.set({
      ...this.state(),
      status: 'downloading',
      progressPercent: undefined,
      message: 'Downloading the required update...'
    });

    try {
      await AppUpdater.downloadAndInstall({
        apkUrl: this.requiredUpdate.apkUrl,
        sha256: this.requiredUpdate.sha256
      });
      this.state.set({
        ...this.state(),
        status: 'installing',
        message: 'Android installer is open. Approve the update, then reopen YumDude Partner.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start the update.';
      this.state.set({
        ...this.state(),
        status: message.toLowerCase().includes('permission') ? 'permission-required' : 'error',
        message
      });
    }
  }

  async openInstallPermissionSettings(): Promise<void> {
    await AppUpdater.openInstallPermissionSettings();
  }

  private async fetchManifest(): Promise<AndroidUpdateManifest> {
    const response = await AppUpdater.fetchManifest({ manifestUrl: this.manifestUrl });
    return JSON.parse(response.json) as AndroidUpdateManifest;
  }

  private normalizeManifest(
    manifest: AndroidUpdateManifest
  ): (Required<Pick<NonNullable<AndroidUpdateManifest['android']>, 'apkUrl' | 'sha256'>> &
    NonNullable<AndroidUpdateManifest['android']>) | null {
    const android = manifest.android;
    if (!android?.apkUrl || !android.sha256) {
      return null;
    }

    return {
      ...android,
      apkUrl: android.apkUrl,
      sha256: android.sha256
    };
  }
}

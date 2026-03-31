import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type RuntimeEnvironmentName = 'prod' | 'dev';

@Injectable({
  providedIn: 'root'
})
export class RuntimeEnvironmentService {
  private readonly STORAGE_KEY = 'nearbite_runtime_environment';
  private readonly config = environment.runtimeEnvironment;
  private readonly defaultEnvironment = this.config.default as RuntimeEnvironmentName;

  getActiveEnvironment(): RuntimeEnvironmentName {
    const storedEnvironment = localStorage.getItem(this.STORAGE_KEY);
    if (storedEnvironment === 'dev' || storedEnvironment === 'prod') {
      return storedEnvironment;
    }

    return this.defaultEnvironment;
  }

  setActiveEnvironment(environmentName: RuntimeEnvironmentName): void {
    localStorage.setItem(this.STORAGE_KEY, environmentName);
  }

  resetToDefault(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  resolveEnvironmentForUsername(username: string): RuntimeEnvironmentName {
    const normalizedUsername = this.normalizeUsername(username);
    const allowlist = this.config.devUsernameAllowlist.map((item) => this.normalizeUsername(item));

    return allowlist.includes(normalizedUsername) ? 'dev' : this.defaultEnvironment;
  }

  getApiBaseUrl(): string {
    return this.config.apiUrls[this.getActiveEnvironment()];
  }

  getWsUrl(): string {
    return this.config.wsUrls[this.getActiveEnvironment()];
  }

  isDevelopmentEnvironment(): boolean {
    return this.getActiveEnvironment() === 'dev';
  }

  getKnownApiBaseUrls(): string[] {
    return Object.values(this.config.apiUrls);
  }

  private normalizeUsername(username: string): string {
    return (username || '').trim().toLowerCase();
  }
}

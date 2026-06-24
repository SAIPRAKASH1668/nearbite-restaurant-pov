import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';

interface AndroidUpdateManifest {
  android?: {
    apkUrl?: string;
  };
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  showPassword = false;
  returnUrl = '/dashboard/welcome';
  showFcmDialog = false;
  readonly isNativePlatform = Capacitor.isNativePlatform();
  androidApkUrl = 'https://yumdude-partner-updates-191491198352-ap-south-1.s3.ap-south-1.amazonaws.com/yumdude-partner/yumdude-partner-v12-release.apk';
  readonly desktopAppUrl = 'https://yumdude-assets.s3.ap-south-1.amazonaws.com/downloads/YumDude-Restaurant-Setup.exe';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private pushNotificationService: PushNotificationService,
    private ngZone: NgZone,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Get return url from route parameters — only allow relative URLs to prevent open redirects
    const raw = this.route.snapshot.queryParams['returnUrl'] || '/dashboard/welcome';
    this.returnUrl = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard/welcome';
    this.loadLatestAndroidApkUrl();
  }

  get f() {
    return this.loginForm.controls;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { username, password } = this.loginForm.value;

    this.authService.login(username, password).subscribe({
      next: (result) => {
        this.ngZone.run(() => {
          if (result.success) {
            if (result.fcmConflict) {
              this.showFcmDialog = true;
              this.isLoading = false;
            } else {
              this.isLoading = false;
              this.router.navigate([this.returnUrl]);
            }
          } else {
            this.errorMessage = result.message || 'Login failed. Please try again.';
            this.isLoading = false;
          }
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.errorMessage = 'An error occurred. Please try again later.';
          this.isLoading = false;
        });
      }
    });
  }

  onTakeOverNotifications(): void {
    void this.pushNotificationService.takeOverNotifications();
    this.router.navigate([this.returnUrl]);
  }

  onViewOnlyMode(): void {
    this.pushNotificationService.setViewOnlyMode();
    this.router.navigate([this.returnUrl]);
  }

  onForgotPassword(): void {
    const username = this.loginForm.get('username')?.value;
    if (username) {
      this.authService.forgotPassword(username).subscribe({
        next: (result) => {
          alert(result.message);
        }
      });
    } else {
      alert('Please enter your email or mobile number first.');
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private loadLatestAndroidApkUrl(): void {
    const manifestUrl = environment.androidUpdateManifestUrl;
    if (!manifestUrl) {
      return;
    }

    this.http.get<AndroidUpdateManifest>(manifestUrl).subscribe({
      next: (manifest) => {
        const apkUrl = manifest.android?.apkUrl;
        if (apkUrl) {
          this.androidApkUrl = apkUrl;
        }
      },
      error: (error) => {
        console.warn('[login] Could not load latest Android APK link', error);
      }
    });
  }
}

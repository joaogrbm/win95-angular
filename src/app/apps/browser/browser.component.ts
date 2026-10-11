import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const HOME_URL = 'https://www.example.com';

@Component({
  selector: 'app-browser',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './browser.component.html',
  styleUrls: ['./browser.component.scss'],
})
export class BrowserComponent {
  private sanitizer = inject(DomSanitizer);

  browserAddress = signal<string>(HOME_URL);
  browserUrl = signal<string>(HOME_URL);
  browserHistory = signal<string[]>([HOME_URL]);
  browserHistoryIndex = signal<number>(0);
  browserReloadToken = signal<number>(0);
  browserSrc = computed(() => this.buildBrowserSrc(this.browserUrl(), this.browserReloadToken()));
  browserSafeSrc = computed<SafeResourceUrl>(() => this.sanitizer.bypassSecurityTrustResourceUrl(this.browserSrc()));

  private buildBrowserSrc(url: string, token: number): string {
    try {
      const parsed = new URL(url);
      const separator = parsed.search ? '&' : '?';
      return `${parsed.toString()}${separator}_=${token}`;
    } catch {
      return url;
    }
  }

  private normalizeUrl(value: string): string {
    let raw = value.trim();
    if (!raw) {
      return HOME_URL;
    }

    if (!/^https?:\/\//i.test(raw)) {
      raw = `https://${raw}`;
    }

    try {
      return new URL(raw).toString();
    } catch {
      return raw;
    }
  }

  private pushBrowserHistory(url: string) {
    const currentIndex = this.browserHistoryIndex();
    const currentHistory = this.browserHistory();
    const normalized = this.normalizeUrl(url);

    if (currentHistory[currentIndex] === normalized) {
      return;
    }

    const nextHistory = currentHistory.slice(0, currentIndex + 1);
    nextHistory.push(normalized);
    this.browserHistory.set(nextHistory);
    this.browserHistoryIndex.set(nextHistory.length - 1);
  }

  navigateBrowser(): void {
    const url = this.normalizeUrl(this.browserAddress());
    this.browserUrl.set(url);
    this.browserAddress.set(url);
    this.pushBrowserHistory(url);
  }

  goHomeBrowser(): void {
    this.browserUrl.set(HOME_URL);
    this.browserAddress.set(HOME_URL);
    this.pushBrowserHistory(HOME_URL);
  }

  goBackBrowser(): void {
    if (this.browserHistoryIndex() <= 0) return;
    const previousIndex = this.browserHistoryIndex() - 1;
    const previousUrl = this.browserHistory()[previousIndex];
    this.browserHistoryIndex.set(previousIndex);
    this.browserUrl.set(previousUrl);
    this.browserAddress.set(previousUrl);
  }

  goForwardBrowser(): void {
    if (this.browserHistoryIndex() >= this.browserHistory().length - 1) return;
    const nextIndex = this.browserHistoryIndex() + 1;
    const nextUrl = this.browserHistory()[nextIndex];
    this.browserHistoryIndex.set(nextIndex);
    this.browserUrl.set(nextUrl);
    this.browserAddress.set(nextUrl);
  }

  reloadBrowser(): void {
    this.browserReloadToken.update(n => n + 1);
  }
}

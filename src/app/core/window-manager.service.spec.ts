import { TestBed } from '@angular/core/testing';
import { WindowManagerService } from './window-manager.service';

describe('WindowManagerService', () => {
  let service: WindowManagerService;

  beforeEach(() => {
    service = TestBed.inject(WindowManagerService);
  });

  it('opens a window and makes it active', () => {
    service.openWindow('paint');
    expect(service.getWindow('paint')?.isOpen).toBeTrue();
    expect(service.activeWindowId()).toBe('paint');
  });

  it('minimizes the active window and activates the next one', () => {
    service.openWindow('paint');
    service.minimizeWindow('paint');
    expect(service.getWindow('paint')?.isMinimized).toBeTrue();
    expect(service.activeWindowId()).toBe('computer');
  });

  it('closes a window', () => {
    service.closeWindow('computer');
    expect(service.openWindows().length).toBe(0);
  });
});

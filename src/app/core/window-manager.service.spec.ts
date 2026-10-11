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

  it('cascades new windows and keeps the position of an already open one', () => {
    service.openWindow('paint');
    service.openWindow('trash');
    const paint = service.getWindow('paint')!;
    const trash = service.getWindow('trash')!;
    expect(trash.x).toBe(paint.x! + 30);
    expect(trash.y).toBe(paint.y! + 30);

    service.moveWindow('paint', { x: 500, y: 400 });
    service.openWindow('paint');
    expect(service.getWindow('paint')?.x).toBe(500);
  });

  it('closes a window', () => {
    service.closeWindow('computer');
    expect(service.openWindows().length).toBe(0);
  });

  it('keeps the window open when its close guard refuses', async () => {
    service.setCloseGuard('computer', () => Promise.resolve(false));
    await service.requestClose('computer');
    expect(service.getWindow('computer')?.isOpen).toBeTrue();

    service.setCloseGuard('computer', () => true);
    await service.requestClose('computer');
    expect(service.getWindow('computer')?.isOpen).toBeFalse();
  });
});

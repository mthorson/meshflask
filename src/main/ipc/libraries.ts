import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { IPC } from '@shared/ipc-channels';
import type {
  AddLibraryRequest,
  AddLibraryResult,
  LibrarySummary,
  PickFolderResult,
  RemoveLibraryRequest,
  RemoveLibraryResult,
  RenameLibraryRequest,
  RenameLibraryResult,
  RevealLibraryResult
} from '@shared/types';
import * as manager from '@main/libraries/manager';

export function registerLibraryIpc(): void {
  ipcMain.handle(IPC.pickFolder, async (event): Promise<PickFolderResult> => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const opts: Electron.OpenDialogOptions = {
      title: 'Select library folder',
      properties: ['openDirectory', 'createDirectory']
    };
    const result = senderWindow
      ? await dialog.showOpenDialog(senderWindow, opts)
      : await dialog.showOpenDialog(opts);
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle(IPC.listLibraries, async (): Promise<LibrarySummary[]> => {
    return manager.listLibraries();
  });

  ipcMain.handle(IPC.addLibrary, async (_e, req: AddLibraryRequest): Promise<AddLibraryResult> => {
    return manager.addLibrary(req);
  });

  ipcMain.handle(IPC.removeLibrary, async (_e, req: RemoveLibraryRequest): Promise<RemoveLibraryResult> => {
    return manager.removeLibrary(req);
  });

  ipcMain.handle(IPC.renameLibrary, async (_e, req: RenameLibraryRequest): Promise<RenameLibraryResult> => {
    return manager.renameLibrary(req);
  });

  ipcMain.handle(IPC.revealLibrary, async (_e, id: string): Promise<RevealLibraryResult> => {
    const entry = manager.listLibraries().find((l) => l.id === id);
    if (!entry) return { ok: false, error: 'Library not found' };
    if (!existsSync(entry.mountPath)) {
      return { ok: false, error: `Mount path not found: ${entry.mountPath}` };
    }
    // openPath opens the folder itself; showItemInFolder would highlight the
    // folder in its parent, which is less useful for a library root.
    const err = await shell.openPath(entry.mountPath);
    if (err) return { ok: false, error: err };
    return { ok: true };
  });
}

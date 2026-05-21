import type { IpcApi } from '@shared/types';

declare global {
  interface Window {
    warehouse3d: IpcApi;
  }
}

export {};

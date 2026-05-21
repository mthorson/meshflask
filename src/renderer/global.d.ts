import type { IpcApi } from '@shared/types';

declare global {
  interface Window {
    meshFlask: IpcApi;
  }
}

export { };

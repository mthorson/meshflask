/**
 * Minimal application menu. Standard roles supply
 * cut/copy/paste/zoom/Quit on every platform; we only add a Help submenu
 * for the log-folder entry and an About panel.
 */
import { Menu, type MenuItemConstructorOptions, app, shell } from 'electron';
import { getLogsDir } from './logger';

export function buildMenu(): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'appMenu' as const }]
      : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open Logs Folder',
          click: () => {
            void shell.openPath(getLogsDir());
          }
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              {
                label: `About ${app.getName()}`,
                click: () => app.showAboutPanel()
              }
            ])
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

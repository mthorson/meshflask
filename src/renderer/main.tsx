import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { App } from './App';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'sm'
});

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');
createRoot(container).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="bottom-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>
);

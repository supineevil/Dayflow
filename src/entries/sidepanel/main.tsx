import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from '@/app/components/AppShell';
import '@/styles/index.css';
import { announcePanelOpen } from './presence';

announcePanelOpen();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);

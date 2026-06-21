import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui';
import { Onboarding } from '@/components/Onboarding';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/stores/useAppStore';
import { OverviewPage } from '@/pages/OverviewPage';
import { MapPage } from '@/pages/MapPage';
import { ConnectionsPage } from '@/pages/ConnectionsPage';
import { ProcessesPage } from '@/pages/ProcessesPage';
import { ProcessDetailPage } from '@/pages/ProcessDetailPage';
import { DestinationsPage } from '@/pages/DestinationsPage';
import { DestinationDetailPage } from '@/pages/DestinationDetailPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  // Single global WebSocket connection for the whole app.
  useWebSocket();
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);

  return (
    <>
      {!onboardingComplete && <Onboarding />}
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="processes" element={<ProcessesPage />} />
          <Route path="processes/:pid" element={<ProcessDetailPage />} />
          <Route path="destinations" element={<DestinationsPage />} />
          <Route path="destinations/:ip" element={<DestinationDetailPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SourceFilterProvider } from './hooks/useSourceFilter';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { SubmitEvents } from './pages/SubmitEvents';
import { PendingAcknowledgements } from './pages/PendingAcknowledgements';
import { Exceptions } from './pages/Exceptions';
import { MqttStatus } from './pages/MqttStatus';
import { ProductionLines } from './pages/ProductionLines';

export default function App() {
  return (
    <BrowserRouter>
      <SourceFilterProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="/submit" element={<SubmitEvents />} />
          <Route path="/pending" element={<PendingAcknowledgements />} />
          <Route path="/exceptions" element={<Exceptions />} />
          <Route path="/mqtt" element={<MqttStatus />} />
          <Route path="/lines" element={<ProductionLines />} />
        </Route>
      </Routes>
      </SourceFilterProvider>
    </BrowserRouter>
  );
}

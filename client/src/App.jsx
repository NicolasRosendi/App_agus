import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { TabBar } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Feed from './pages/Feed.jsx';
import Reels from './pages/Reels.jsx';
import Compose from './pages/Compose.jsx';
import Meets from './pages/Meets.jsx';
import Profile from './pages/Profile.jsx';
import Steps from './pages/Steps.jsx';
import Settings from './pages/Settings.jsx';

// Todo lo que usa Leaflet o three.js se carga bajo demanda.
const MapPage = lazy(() => import('./pages/MapPage.jsx'));
const MeetDetail = lazy(() => import('./pages/MeetDetail.jsx'));
const MeetOps = lazy(() => import('./pages/MeetOps.jsx'));
const CreateMeet = lazy(() => import('./pages/CreateMeet.jsx'));
const Garage = lazy(() => import('./pages/Garage.jsx'));

const NO_TABS = [/^\/crear/, /^\/juntadas\/nueva/, /^\/juntadas\/[^/]+\/ops/];

export default function App() {
  const { user, ready } = useAuth();
  const { pathname } = useLocation();

  if (!ready) return <div className="app-shell"><div className="spinner" style={{ marginTop: '45vh' }} /></div>;

  return (
    <div className="app-shell">
      {!user ? <Login /> : (
        <>
          <Suspense fallback={<div className="spinner" style={{ marginTop: '40vh' }} />}>
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/reels" element={<Reels />} />
              <Route path="/crear" element={<Compose />} />
              <Route path="/mapa" element={<MapPage />} />
              <Route path="/juntadas" element={<Meets />} />
              <Route path="/juntadas/nueva" element={<CreateMeet />} />
              <Route path="/juntadas/:id" element={<MeetDetail />} />
              <Route path="/juntadas/:id/ops" element={<MeetOps />} />
              <Route path="/perfil" element={<Profile />} />
              <Route path="/perfil/:handle" element={<Profile />} />
              <Route path="/garage" element={<Garage />} />
              <Route path="/pasos" element={<Steps />} />
              <Route path="/ajustes" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          {!NO_TABS.some((r) => r.test(pathname)) && <TabBar />}
        </>
      )}
      <div id="overlay-root" />
    </div>
  );
}

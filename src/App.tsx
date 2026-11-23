import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';

// Lazy loading com auto-recuperação caso o celular tenha em cache uma versão antiga após deploy na Vercel
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const reloadKey = 'igrejapro_chunk_reload';
      const lastReload = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastReload || now - Number(lastReload) > 15000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
      }
      throw error;
    }
  });
}

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Members = lazyWithRetry(() => import('./pages/Members').then(m => ({ default: m.Members })));
const MyGroup = lazyWithRetry(() => import('./pages/MyGroup').then(m => ({ default: m.MyGroup })));
const Discipleship = lazyWithRetry(() => import('./pages/Discipleship').then(m => ({ default: m.Discipleship })));
const Network = lazyWithRetry(() => import('./pages/Network').then(m => ({ default: m.Network })));
const Finance = lazyWithRetry(() => import('./pages/Finance').then(m => ({ default: m.Finance })));
const Reports = lazyWithRetry(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const QA = lazyWithRetry(() => import('./pages/QA').then(m => ({ default: m.QA })));
const Cells = lazyWithRetry(() => import('./pages/Cells').then(m => ({ default: m.Cells })));
const MemberProfile = lazyWithRetry(() => import('./pages/MemberProfile').then(m => ({ default: m.MemberProfile })));
const AdminUsers = lazyWithRetry(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })));
const Georeferencing = lazyWithRetry(() => import('./pages/Georeferencing'));
const AiConsultant = lazyWithRetry(() => import('./pages/AiConsultant').then(m => ({ default: m.AiConsultant })));
const AiInsights = lazyWithRetry(() => import('./pages/AiInsights').then(m => ({ default: m.AiInsights })));
const Birthdays = lazyWithRetry(() => import('./pages/Birthdays').then(m => ({ default: m.Birthdays })));
const Simulations = lazyWithRetry(() => import('./pages/Simulations').then(m => ({ default: m.Simulations })));
const Families = lazyWithRetry(() => import('./pages/Families').then(m => ({ default: m.Families })));
const Companionship = lazyWithRetry(() => import('./pages/Companionship').then(m => ({ default: m.Companionship })));
const LabVision = lazyWithRetry(() => import('./pages/LabVision').then(m => ({ default: m.LabVision })));
const LabVisits = lazyWithRetry(() => import('./pages/LabVisits').then(m => ({ default: m.LabVisits })));
const LabQuery = lazyWithRetry(() => import('./pages/LabQuery').then(m => ({ default: m.LabQuery })));
const Sectors = lazyWithRetry(() => import('./pages/Sectors').then(m => ({ default: m.Sectors })));
const LeaderViews = lazyWithRetry(() => import('./pages/LeaderViews').then(m => ({ default: m.LeaderViews })));

const PageLoader: React.FC = () => (
  <div className="flex h-64 flex-col items-center justify-center gap-3">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    <span className="text-xs font-semibold text-gray-500">Carregando módulo...</span>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                {/* All authenticated users */}
                <Route path="/" element={<Dashboard />} />

                {/* Dynamic accessible routes */}
                <Route path="/georeferencing" element={<Georeferencing />} />
                <Route path="/members" element={<Members />} />
                <Route path="/families" element={<Families />} />
                <Route path="/birthdays" element={<Birthdays />} />
                <Route path="/cells" element={<Cells />} />
                <Route path="/sectors" element={<Sectors />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/qa" element={<QA />} />
                <Route path="/discipleship" element={<Discipleship />} />
                <Route path="/network" element={<Network />} />
                <Route path="/membro/:name" element={<MemberProfile />} />
                <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'financeiro']} />}>
                  <Route path="/finance" element={<Finance />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['admin', 'secretaria']} />}>
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/sync" element={<Navigate to="/admin/users" replace />} />
                </Route>
                <Route path="/settings" element={<Navigate to="/admin/users" replace />} />
                <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor']} />}>
                  <Route path="/simulations" element={<Simulations />} />
                  <Route path="/lab/vision" element={<LabVision />} />
                  <Route path="/lab/visits" element={<LabVisits />} />
                  <Route path="/lab/queries" element={<LabQuery />} />
                </Route>
                <Route path="/companionship" element={<Companionship />} />
                <Route path="/my-group" element={<MyGroup />} />
                <Route path="/leader-views" element={<LeaderViews />} />
                <Route path="/ai-consultant" element={<AiConsultant />} />
                <Route path="/ai-insights" element={<AiInsights />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

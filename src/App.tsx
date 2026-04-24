import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Members } from './pages/Members';
import { MyGroup } from './pages/MyGroup';
import { Discipleship } from './pages/Discipleship';
import { Network } from './pages/Network';
import { Finance } from './pages/Finance';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { QA } from './pages/QA';
import { Cells } from './pages/Cells';
import { MemberProfile } from './pages/MemberProfile';
import { AdminUsers } from './pages/AdminUsers';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* All authenticated users */}
              <Route path="/" element={<Dashboard />} />

              {/* Secretaria + Pastor + Admin */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'secretaria']} />}>
                <Route path="/members" element={<Members />} />
                <Route path="/cells" element={<Cells />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/qa" element={<QA />} />
                <Route path="/discipleship" element={<Discipleship />} />
                <Route path="/network" element={<Network />} />
              </Route>

              {/* CRM — pastor + admin + secretaria */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'secretaria']} />}>
                <Route path="/crm/:name" element={<MemberProfile />} />
              </Route>

              {/* Finance — financeiro + pastor + admin */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'financeiro']} />}>
                <Route path="/finance" element={<Finance />} />
              </Route>

              {/* Admin only */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* Legacy */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/my-group" element={<MyGroup />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

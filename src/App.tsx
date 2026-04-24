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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              
              <Route path="/members" element={<Members />} />
              
              <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'secretary']} />}>
                 <Route path="/reports" element={<Reports />} />
                 <Route path="/qa" element={<QA />} />
              </Route>
              
              {/* Only leader role can access their group */}
              <Route element={<ProtectedRoute allowedRoles={['leader', 'admin']} />}>
                 <Route path="/my-group" element={<MyGroup />} />
              </Route>

              {/* Discipleship / MDA */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'leader']} />}>
                 <Route path="/discipleship" element={<Discipleship />} />
                 <Route path="/network" element={<Network />} />
              </Route>

              {/* Finance Role access */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'pastor', 'finance']} />}>
                  <Route path="/finance" element={<Finance />} />
              </Route>

              {/* Admin only Settings */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/settings" element={<Settings />} />
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

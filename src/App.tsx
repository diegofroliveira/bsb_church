import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
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
import Georeferencing from './pages/Georeferencing';
import { AiConsultant } from './pages/AiConsultant';
import { AiInsights } from './pages/AiInsights';
import Birthdays from './pages/Birthdays';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* All authenticated users */}
              {/* All authenticated users */}
              <Route path="/" element={<Dashboard />} />

              {/* Dynamic accessible routes */}
              <Route path="/georeferencing" element={<Georeferencing />} />
              <Route path="/members" element={<Members />} />
              <Route path="/cells" element={<Cells />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/qa" element={<QA />} />
              <Route path="/discipleship" element={<Discipleship />} />
              <Route path="/network" element={<Network />} />
               <Route path="/crm/:name" element={<MemberProfile />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/my-group" element={<MyGroup />} />
              <Route path="/ai-consultant" element={<AiConsultant />} />
              <Route path="/ai-insights" element={<AiInsights />} />
              <Route path="/birthdays" element={<Birthdays />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

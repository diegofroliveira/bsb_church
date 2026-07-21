import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ContextRequiredRoute } from './components/ContextRequiredRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { OrganizationProvider } from './context/OrganizationContext'
import { MainLayout } from './layouts/MainLayout'
import { Birthdays } from './pages/Birthdays'
import { AcceptInvitation } from './pages/AcceptInvitation'
import { Cells } from './pages/Cells'
import { Companionship } from './pages/Companionship'
import { CoreAdministration } from './pages/CoreAdministration'
import { Dashboard } from './pages/Dashboard'
import { Discipleship } from './pages/Discipleship'
import { Families } from './pages/Families'
import { Finance } from './pages/Finance'
import Georeferencing from './pages/Georeferencing'
import { LabQuery } from './pages/LabQuery'
import { LabVision } from './pages/LabVision'
import { LabVisits } from './pages/LabVisits'
import { LeaderViews } from './pages/LeaderViews'
import { Login } from './pages/Login'
import { MemberProfile } from './pages/MemberProfile'
import { Members } from './pages/Members'
import { MyGroup } from './pages/MyGroup'
import { Network } from './pages/Network'
import { Onboarding } from './pages/Onboarding'
import { QA } from './pages/QA'
import { Reports } from './pages/Reports'
import { ResetPassword } from './pages/ResetPassword'
import { Sectors } from './pages/Sectors'
import { Simulations } from './pages/Simulations'

function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/accept-invite" element={<AcceptInvitation />} />

              <Route element={<ContextRequiredRoute />}>
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="people"
                        requiredPermission="people.read"
                      />
                    }
                  >
                    <Route path="/georeferencing" element={<Georeferencing />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/families" element={<Families />} />
                    <Route path="/birthdays" element={<Birthdays />} />
                    <Route path="/membro/:name" element={<MemberProfile />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="groups"
                        requiredPermission="groups.read"
                      />
                    }
                  >
                    <Route path="/cells" element={<Cells />} />
                    <Route path="/sectors" element={<Sectors />} />
                    <Route path="/network" element={<Network />} />
                    <Route path="/my-group" element={<MyGroup />} />
                    <Route path="/leader-views" element={<LeaderViews />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="care"
                        requiredPermission="care.read"
                      />
                    }
                  >
                    <Route path="/discipleship" element={<Discipleship />} />
                    <Route path="/companionship" element={<Companionship />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="finance"
                        requiredPermission="finance.read"
                      />
                    }
                  >
                    <Route path="/finance" element={<Finance />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="analytics"
                        requiredPermission="analytics.read"
                      />
                    }
                  >
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/qa" element={<QA />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="analytics"
                        requiredPermission="analytics.manage"
                      />
                    }
                  >
                    <Route path="/simulations" element={<Simulations />} />
                    <Route path="/lab/vision" element={<LabVision />} />
                    <Route path="/lab/visits" element={<LabVisits />} />
                    <Route path="/lab/queries" element={<LabQuery />} />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute
                        requiredModule="foundation"
                        requiredPermission="tenant.manage"
                      />
                    }
                  >
                    <Route path="/settings" element={<CoreAdministration />} />
                  </Route>

                  <Route path="/admin/users" element={<Navigate to="/settings" replace />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </OrganizationProvider>
    </AuthProvider>
  )
}

export default App

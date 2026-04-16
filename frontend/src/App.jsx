import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { I18nProvider } from './i18n';
import Navbar from './components/Layout/Navbar';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import Login from './pages/Login';
import Users from './pages/admin/Users';
import Tasks from './pages/admin/Tasks';
import MyTasks from './pages/user/MyTasks';
import AllTasks from './pages/user/AllTasks';
import TaskTracking from './pages/user/TaskTracking';

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/my-tasks" /> : <Login />} />
        <Route path="/admin/users" element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
        <Route path="/admin/tasks" element={<ProtectedRoute adminOnly><Tasks /></ProtectedRoute>} />
        <Route path="/my-tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        <Route path="/all-tasks" element={<ProtectedRoute><AllTasks /></ProtectedRoute>} />
        <Route path="/task/:id" element={<ProtectedRoute><TaskTracking /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? '/my-tasks' : '/login'} />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <Toaster position="top-right" />
            <AppRoutes />
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}

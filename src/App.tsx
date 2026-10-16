import LoginPage from './features/auth/LoginPage'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import UploadForm from './features/upload/UploadForm';
import DocumentSearch from './features/documents/DocumentSearch';
import ProtectedRoute from './components/ProtectedRoute';
import CreateUser from './components/CreateUser';
import AppLayout from './components/AppLayout';
import './components/AppLayout.css'
function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage/>} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          {/* Navbar wraps every page inside this group */}
          <Route element={<AppLayout />}>
            <Route path="/upload" element={<UploadForm />} />
            <Route path="/search" element={<DocumentSearch />} />
            <Route path="/admin" element={<CreateUser />} />
          </Route>
        </Route>

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
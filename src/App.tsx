import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './features/auth/LoginPage';
import UploadForm from './features/upload/UploadForm';
import DocumentSearch from './features/documents/DocumentSearch';
import ProtectedRoute from './components/ProtectedRoute';
import CreateUser from './components/CreateUser';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import './components/AppLayout.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/upload" element={<UploadForm />} />
              <Route path="/search" element={<DocumentSearch />} />
              <Route path="/admin" element={<CreateUser />} />
            </Route>
          </Route>

          {/* Fallback for unknown routes */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
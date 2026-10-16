import './App.css'
import LoginPage from './features/auth/LoginPage'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';  
import UploadForm from './features/upload/UploadForm';
import DocumentSearch from './features/documents/DocumentSearch';
import ProtectedRoute from './components/ProtectedRoute';

function App() {  

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage/>} />
       {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/upload" element={<UploadForm />} />
        <Route path="/search" element={<DocumentSearch />} />
      </Route>
      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App

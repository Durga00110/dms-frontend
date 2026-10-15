import './App.css'
import LoginPage from './features/auth/LoginPage'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';  
import 'bootstrap/dist/css/bootstrap.min.css';
import UploadForm from './features/upload/UploadForm';
import DocumentSearch from './features/documents/DocumentSearch';

function App() {  

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage/>} />
        <Route path="/upload" element={<UploadForm/>} />
        <Route path="/search" element={<DocumentSearch/>} />
      </Routes>
    </Router>
  )
}

export default App

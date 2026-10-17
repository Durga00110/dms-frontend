import { Link } from 'react-router-dom';

export default function NotFound() {
    const handleBackToHome = ()=>{
        localStorage.removeItem('token')
        localStorage.removeItem("test_mdr")
    }
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <h1>404</h1>
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/" onClick={handleBackToHome}>Back to home</Link>
      </div>
    </div>
  );
}
import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Home from './pages/HomeFigma.jsx';
import LoginPage from './pages/LoginPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout>
            <Home />
          </AppLayout>
        }
      />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

import { Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import AboutPage from './pages/AboutPage.jsx';
import Home from './pages/HomeFigma.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NeighborhoodPage from './pages/NeighborhoodPage.jsx';
import NewReportPage from './pages/NewReportPage.jsx';
import RankingPage from './pages/RankingPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import WelcomePage from './pages/WelcomePage.jsx';

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
      <Route
        path="/ranking"
        element={
          <AppLayout>
            <RankingPage />
          </AppLayout>
        }
      />
      <Route
        path="/relatos"
        element={
          <AppLayout>
            <ReportsPage />
          </AppLayout>
        }
      />
      <Route
        path="/bairro/:slug"
        element={
          <AppLayout>
            <NeighborhoodPage />
          </AppLayout>
        }
      />
      <Route
        path="/sobre"
        element={
          <AppLayout>
            <AboutPage />
          </AppLayout>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/novo-relato" element={<NewReportPage />} />
      <Route path="/cadastro/sucesso" element={<WelcomePage />} />
      <Route path="/welcome" element={<WelcomePage />} />
    </Routes>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import KycQueuePage from './pages/KycQueuePage';
import KycDetailPage from './pages/KycDetailPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import RidesPage from './pages/RidesPage';
import RideDetailPage from './pages/RideDetailPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import RevenuePage from './pages/RevenuePage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <OverviewPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc"
            element={
              <ProtectedRoute>
                <Layout>
                  <KycQueuePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kyc/:userId"
            element={
              <ProtectedRoute>
                <Layout>
                  <KycDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <UserDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rides"
            element={
              <ProtectedRoute>
                <Layout>
                  <RidesPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rides/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <RideDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Layout>
                  <OrdersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <OrderDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/revenue"
            element={
              <ProtectedRoute>
                <Layout>
                  <RevenuePage />
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

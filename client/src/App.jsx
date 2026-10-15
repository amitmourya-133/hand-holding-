import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard.jsx';
import Mentors from './pages/Mentors.jsx';
import Connections from './pages/Connections.jsx';
import Messages from './pages/Messages.jsx';
import Meetings from './pages/Meetings.jsx';
import Goals from './pages/Goals.jsx';
import Feedback from './pages/Feedback.jsx';
import Profile from './pages/Profile.jsx';
import Admin from './pages/Admin.jsx';
import ProgressReports from './pages/ProgressReports.jsx';
import MyQuestions from './pages/MyQuestions.jsx';
import OpenQuestions from './pages/OpenQuestions.jsx';
import QuestionDetails from './pages/QuestionDetails.jsx';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading App for Hand Holding...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/reset/:token" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="mentors" element={<Mentors />} />
        <Route path="connections" element={<Connections />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:id" element={<Messages />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="goals" element={<Goals />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="profile" element={<Profile />} />
        <Route path="ask-question" element={<AskQuestion />} />
        <Route path="progress-reports" element={<ProgressReports />} />
        <Route path="my-questions" element={<MyQuestions />} />
        <Route path="open-questions" element={<OpenQuestions />} />
        <Route path="question/:id" element={<QuestionDetails />} />
        <Route
          path="admin"
          element={
            <Protected roles={['admin']}>
              <Admin />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

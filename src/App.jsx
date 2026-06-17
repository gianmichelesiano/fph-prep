import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Quiz from './pages/Quiz'
import Results from './pages/Results'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Upgrade from './pages/Upgrade'
import PaymentSuccess from './pages/PaymentSuccess'
import Simulations from './pages/Simulations'
import Study from './pages/Study'
import StudyArea from './pages/StudyArea'
import StudyTopic from './pages/StudyTopic'

import AdminAreas from './pages/admin/Areas'
import AdminAreaDetail from './pages/admin/AreaDetail'
import AdminDashboard from './pages/admin/Dashboard'
import AdminQuestions from './pages/admin/Questions'
import AdminQuestionEditor from './pages/admin/QuestionEditor'
import AdminSimulations from './pages/admin/Simulations'
import AdminSimulationEditor from './pages/admin/SimulationEditor'
import AdminUsers from './pages/admin/Users'
import AdminGenerate from './pages/admin/Generate'
import AdminCatalog from './pages/admin/Catalog'
import AdminContents from './pages/admin/Contents'
import AdminContentEditor from './pages/admin/ContentEditor'
import AdminTopicDetail from './pages/admin/TopicDetail'
import AdminJobs from './pages/admin/Jobs'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pubbliche */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />

          {/* Protette (richiede login) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/quiz/:id" element={<Quiz />} />
            <Route path="/results/:id" element={<Results />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/simulations" element={<Simulations />} />
            <Route path="/study" element={<Study />} />
            <Route path="/study/area/:area_id" element={<StudyArea />} />
            <Route path="/study/topic/:key" element={<StudyTopic />} />
          </Route>

          {/* Admin (richiede is_admin) */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/areas" element={<AdminAreas />} />
            <Route path="/admin/areas/:area_id" element={<AdminAreaDetail />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
            <Route path="/admin/questions/new" element={<AdminQuestionEditor />} />
            <Route path="/admin/questions/:id" element={<AdminQuestionEditor />} />
            <Route path="/admin/simulations" element={<AdminSimulations />} />
            <Route path="/admin/simulations/:id" element={<AdminSimulationEditor />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/catalog" element={<AdminCatalog />} />
            <Route path="/admin/generate" element={<AdminGenerate />} />
            <Route path="/admin/contents" element={<AdminContents />} />
            <Route path="/admin/contents/:notebook_id" element={<AdminContentEditor />} />
            <Route path="/admin/areas/:area_id/topics/:topic_id" element={<AdminTopicDetail />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

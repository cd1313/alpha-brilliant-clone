import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AiEnabledProvider } from './components/AiEnabledProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CourseMapPage } from './pages/CourseMapPage'
import { InsightsPage } from './pages/InsightsPage'
import { LessonCompletePage } from './pages/LessonCompletePage'
import { LessonPage } from './pages/LessonPage'
import { LoginPage } from './pages/LoginPage'
import { PracticePage } from './pages/PracticePage'
import { PreAssessmentPage } from './pages/PreAssessmentPage'
import { ReviewPage } from './pages/ReviewPage'
import { UnitTestPage } from './pages/UnitTestPage'
import { VerifyEmailPage } from './pages/VerifyEmailPage'
import './App.css'

function App() {
  return (
    <AiEnabledProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <CourseMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pre-assessment/:sectionId"
          element={
            <ProtectedRoute>
              <PreAssessmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <ReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <InsightsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson/:lessonId"
          element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson/:lessonId/practice"
          element={
            <ProtectedRoute>
              <PracticePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lesson/:lessonId/complete"
          element={
            <ProtectedRoute>
              <LessonCompletePage />
            </ProtectedRoute>
          }
        />
        <Route path="/unit-test/:sectionId" element={<UnitTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </AiEnabledProvider>
  )
}

export default App

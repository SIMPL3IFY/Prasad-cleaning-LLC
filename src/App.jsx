import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Services from './pages/Services'
import Testimonials from './pages/Testimonials'
import Contact from './pages/Contact'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ResetPassword from './pages/ResetPassword'
import ResetConfirmation from './pages/ResetConfirmation'
// Scrum 177: Email confirmation landing page
import AuthCallback from './pages/AuthCallback'
import ServiceArea from './pages/ServiceArea'
import CustomerPortal from './pages/CustomerPortal'
import AppointmentReview from './pages/AppointmentReview'
import Settings from './pages/Settings'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'
import ProtectedCustomerRoute from './components/ProtectedCustomerRoute'
// SCRUM-119: Admin dashboard page
import AdminDashboard from './pages/AdminDashboard'

/* Scrum 39 for exporting the page */
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/* Scrum 39 to add header depending on the page */
function AppContent() {
  const { pathname } = useLocation()
  const removeHeader = ['/portal', '/admin']
  return (
    <>
      <ScrollToTop />
      {/* Scrum 39 check if page should have a header */}
      {!removeHeader.includes(pathname) && <Header />}
      <main style={{ minHeight: '81vh' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/testimonials" element={<Testimonials />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password/continue" element={<ResetConfirmation />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/service-area" element={<ServiceArea />} />
          <Route path="/portal" element={<CustomerPortal />} />
          <Route path="/review/:token" element={<AppointmentReview />} />
          <Route path="/settings" element={<Settings />} />
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </>
  )
}
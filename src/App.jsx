import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Services from './pages/Services'
import Testimonials from './pages/Testimonials'
import Contact from './pages/Contact'
import SignIn from './pages/SignIn'
import ServiceArea from './pages/ServiceArea'
import CustomerPortal from './pages/CustomerPortal'

/* Scrum 39 for exporting the page */
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

/* Scrum 39 to add header depending on the page */
function AppContent() {
  const { pathname } = useLocation()
  const removeHeader = ['/portal']
  return (
    <>
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
          <Route path="/service-area" element={<ServiceArea />} /> 
          <Route path="/portal" element={<CustomerPortal />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

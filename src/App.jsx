import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

export default function App() {
  return (
    <BrowserRouter>
      <Header />
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
    </BrowserRouter>
  )
}

//Test file for portal

import { Link } from 'react-router-dom'

export default function CustomerPortal() {
    
    return(
        //scrum 39 to navigate to landing page from logo
        //create the header for the page
        //the header contains the company logo and when clicked, will redirect to Home.jsx
        //here the logo png is added and the to Home.jsx link is in App.jsx
        //the logo png is in assests and is named logo.png
        <header className="header">
            <div className="container header-inner">
                 <Link to="/" className="logo" aria-label="Prasad's Cleaning Services LLC">
                 <img className="logo-img" src="/assets/logo.png" alt="Prasad's Cleaning Services LLC" />
                </Link>
            </div>
        </header>
    )
}

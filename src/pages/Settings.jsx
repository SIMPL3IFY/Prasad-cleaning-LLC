import React from 'react';
import { Link } from 'react-router-dom';

export default function Settings() {
    return (

        //This section is for Scrum 115 to create boxes where users can change their settings
        //this includes their email address, phone number, business or residential address, and password
        <main className="section"> 
            <div className="container">
        
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
                    <h2 className="section-title">Change User Settings</h2>
                    <p className="section-subtitle">Update your account information below</p>
                </div>
                
                {/* Use the format of the Sign-In form, but without floating box outline and adjust the size to center in the page */}
                <form className="signin-form" style={{ maxWidth: '500px', margin: '0 auto' }}>

                    {/* Scrum 115: Create all the boxes to change settings */}
                    <div className="form-group">
                        <label htmlFor="email">Change Email Address</label>
                        <input type="email" id="email" placeholder="new-email@example.com" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="phone">Change Phone Number</label>
                        <input type="tel" id="phone" placeholder="(XXX) XXX-XXXX" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="address">Change Business or Residential Address</label>
                        <input type="text" id="address" placeholder="123 Main St, City, State, Zip Code" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">Change Password</label>
                        <input type="password" id="password" placeholder="********" />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="password">Re-Enter New Password</label>
                        <input type="password" id="password" placeholder="********" />
                    </div>
                    
                    {/* Button for user to change settings
                         Scrum 115, redirects to customer portal page but
                         in a later Scrum, will update database*/}
                    <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
                        <Link to="/portal" className="button button-main" >
                            Save
                        </Link>
                    </div>
                    
                    {/* Scrum 115: "Cancel" link button to redirect user back to customer portal page */}
                    <div className="signin-footer" style={{ marginTop: 'var(--space-md)' }}>
                        <Link to="/portal" style={{ textDecoration: 'underline', fontSize: '0.85rem' }}>
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}

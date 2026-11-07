"""Functional (black-box) tests for the Site Header (SCRUM-233).

Drives a real Chrome browser against the running site to verify:
- Navigation links (Services, About, Testimonials, Service Areas, Contact)
- Header Logo link redirecting to Home
- 404 handling for unknown routes showing proper heading content and home redirection link
- Desktop and Mobile authentication flows (Signed-out, Customer, and Admin)
- Sign out verification ensuring 'Sign In' reappears in the header DOM
"""
import os
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from conftest import BASE_URL, button, scroll_and_click, wait_for_path, wait_for_text

# Account credentials from environment variables
CUSTOMER_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")
needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to run customer tests",
)

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
needs_admin_account = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run admin tests",
)


def sign_in(driver, open_page, wait, email, password):
    """Helper function to log in to the site."""
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(*button("Sign In")).click()


# ------------------------------------------------------------------------------
# 1. Navigation Links & Logo (Signed-Out Visitor)
# ------------------------------------------------------------------------------

def test_header_logo_navigates_to_home(driver, open_page, wait):
    """Clicking the logo redirects to the homepage."""
    open_page("/about")
    wait_for_path(wait, "/about")

    logo = driver.find_element(By.CSS_SELECTOR, "a.logo")
    logo.click()

    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)


def test_header_all_nav_links(driver, open_page, wait):
    """Tests clicking every main navigation link in the header."""
    open_page("/")

    # 1. Services link
    scroll_and_click(wait, (By.LINK_TEXT, "Services"))
    wait_for_path(wait, "/services")

    # 2. About link
    scroll_and_click(wait, (By.LINK_TEXT, "About"))
    wait_for_path(wait, "/about")

    # 3. Testimonials link
    scroll_and_click(wait, (By.LINK_TEXT, "Testimonials"))
    wait_for_path(wait, "/testimonials")

    # 4. Service Areas link
    scroll_and_click(wait, (By.LINK_TEXT, "Service Areas"))
    wait_for_path(wait, "/service-area")

    # 5. Contact link
    scroll_and_click(wait, (By.LINK_TEXT, "Contact"))
    wait_for_path(wait, "/contact")


def test_header_sign_in_button_signed_out(driver, open_page, wait):
    """Clicking 'Sign In' in header redirects to /signin for signed-out users."""
    open_page("/")
    scroll_and_click(wait, (By.LINK_TEXT, "Sign In"))
    wait_for_path(wait, "/signin")


# ------------------------------------------------------------------------------
# 2. 404 Route Handling & Home Redirection Link
# ------------------------------------------------------------------------------

def test_invalid_url_shows_404_and_navigates_home(driver, open_page, wait):
    """Navigating to a non-existent URL displays the 404 page and 'Back to Home' links back home."""
    open_page("/some-invalid-page-xyz")
    
    # Verify 404 header is present
    h1 = wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), '404')]")))
    assert "404" in h1.text

    # Click the 'Back to Home' link and verify it returns to BASE_URL root
    home_link = wait.until(EC.element_to_be_clickable((By.LINK_TEXT, "Back to Home")))
    home_link.click()
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)


# ------------------------------------------------------------------------------
# 3. Mobile View & Hamburger Toggle Button
# ------------------------------------------------------------------------------

def test_mobile_hamburger_and_mobile_links(driver, open_page, wait):
    """Resizes screen to mobile and tests hamburger menu toggle and navigation."""
    driver.set_window_size(375, 812)
    open_page("/")

    hamburger = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "button.hamburger"))
    assert hamburger.is_displayed()

    # Open mobile menu
    hamburger.click()
    assert wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "nav.nav.nav-open")).is_displayed()

    # Click a link inside mobile menu
    scroll_and_click(wait, (By.LINK_TEXT, "About"))
    wait_for_path(wait, "/about")


# ------------------------------------------------------------------------------
# 4. Logged-in Customer Flow
# ------------------------------------------------------------------------------

@needs_customer_account
def test_header_customer_dashboard_and_sign_out(driver, open_page, wait):
    """Tests Customer 'Dashboard' and 'Sign Out' buttons in the header and verifies Sign In reappears."""
    sign_in(driver, open_page, wait, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    wait_for_path(wait, "/portal")

    # Navigate to a public page to test header buttons
    open_page("/about")

    # Click Dashboard button in header -> should redirect customer to /portal
    scroll_and_click(wait, button("Dashboard"))
    wait_for_path(wait, "/portal")

    # Navigate to /about again to click Sign Out button in header
    open_page("/about")
    scroll_and_click(wait, button("Sign Out"))

    # Should sign out, return to home page, and verify 'Sign In' button reappears in DOM
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)
    signin_link = wait.until(EC.visibility_of_element_located((By.LINK_TEXT, "Sign In")))
    assert signin_link.is_displayed()


# ------------------------------------------------------------------------------
# 5. Logged-in Admin Flow
# ------------------------------------------------------------------------------

@needs_admin_account
def test_header_admin_dashboard_and_sign_out(driver, open_page, wait):
    """Tests Admin 'Dashboard' and 'Sign Out' buttons in the header and verifies Sign In reappears."""
    sign_in(driver, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)
    wait_for_path(wait, "/admin")

    # Navigate to a public page to test header buttons
    open_page("/about")

    # Click Dashboard button in header -> should redirect admin to /admin
    scroll_and_click(wait, button("Dashboard"))
    wait_for_path(wait, "/admin")

    # Navigate to /about again to click Sign Out button in header
    open_page("/about")
    scroll_and_click(wait, button("Sign Out"))

    # Should sign out, return to home page, and verify 'Sign In' button reappears in DOM
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)
    signin_link = wait.until(EC.visibility_of_element_located((By.LINK_TEXT, "Sign In")))
    assert signin_link.is_displayed()
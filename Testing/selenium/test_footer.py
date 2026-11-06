"""Functional (black-box) tests for the Site Footer (SCRUM-234).

Drives a real Chrome browser against the running site to verify:
- Brand logo link
- Company links (About Us, Testimonials, Contact)
- Services links (Our Services, Service Areas)
- Contact protocols (tel: and mailto:)
- Account links when signed out (Sign In, Create Account)
- Account links when signed in as Customer (Dashboard -> /portal, Settings)
- Account links when signed in as Admin (Dashboard -> /admin, Settings)
"""
import os
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, button, wait_for_path

# Account credentials from environment variables
CUSTOMER_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")
needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to run customer footer tests",
)

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
needs_admin_account = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run admin footer tests",
)


def sign_in(driver, open_page, wait, email, password):
    """Helper function to log in to the site."""
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(*button("Sign In")).click()


def click_footer_link(driver, locator):
    """Scrolls to and clicks a footer link via JS to bypass sticky headers/interception."""
    element = driver.find_element(*locator)
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    driver.execute_script("arguments[0].click();", element)


# ------------------------------------------------------------------------------
# 1. Signed-Out Footer Links
# ------------------------------------------------------------------------------

def test_footer_brand_logo_navigates_home(driver, open_page, wait):
    """Clicking the brand name in the footer returns the user to the home page."""
    open_page("/about")
    wait_for_path(wait, "/about")

    click_footer_link(driver, (By.CSS_SELECTOR, "footer a.footer-brand-name"))
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)


def test_footer_company_column_links(driver, open_page, wait):
    """Verifies Company column links: About Us, Testimonials, Contact."""
    open_page("/")

    # About Us
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/about']"))
    wait_for_path(wait, "/about")

    open_page("/")
    # Testimonials
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/testimonials']"))
    wait_for_path(wait, "/testimonials")

    open_page("/")
    # Contact
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/contact']"))
    wait_for_path(wait, "/contact")


def test_footer_services_column_links(driver, open_page, wait):
    """Verifies Services column links: Our Services, Service Areas."""
    open_page("/")

    # Our Services
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/services']"))
    wait_for_path(wait, "/services")

    open_page("/")
    # Service Areas
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/service-area']"))
    wait_for_path(wait, "/service-area")


def test_footer_signed_out_account_links(driver, open_page, wait):
    """Verifies Account column links when signed out: Sign In, Create Account."""
    open_page("/")

    # Sign In
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/signin']"))
    wait_for_path(wait, "/signin")

    open_page("/")
    # Create Account
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/signup']"))
    wait_for_path(wait, "/signup")


def test_footer_get_in_touch_protocols(driver, open_page, wait):
    """Verifies that tel: and mailto: contact links are present inside the footer."""
    open_page("/")

    phone_link = driver.find_element(By.CSS_SELECTOR, "footer a[href^='tel:']")
    assert phone_link.is_displayed()

    email_link = driver.find_element(By.CSS_SELECTOR, "footer a[href^='mailto:']")
    assert email_link.is_displayed()


# ------------------------------------------------------------------------------
# 2. Logged-In Customer Footer Links
# ------------------------------------------------------------------------------

@needs_customer_account
def test_footer_customer_account_links(driver, open_page, wait):
    """Verifies Account column when logged in as a customer: Dashboard (/portal) and Settings."""
    sign_in(driver, open_page, wait, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    wait_for_path(wait, "/portal")

    open_page("/about")

    # Wait for customer portal dashboard link to render in footer
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "footer a[href='/portal']")))
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/portal']"))
    wait_for_path(wait, "/portal")

    # Click Settings in Footer
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "footer a[href='/settings']")))
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/settings']"))
    wait_for_path(wait, "/settings")


# ------------------------------------------------------------------------------
# 3. Logged-In Admin Footer Links
# ------------------------------------------------------------------------------

@needs_admin_account
def test_footer_admin_account_links(driver, open_page, wait):
    """Verifies Account column when logged in as an admin: Dashboard (/admin) and Settings."""
    sign_in(driver, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)
    wait_for_path(wait, "/admin")

    open_page("/about")

    # Wait for the async admin role lookup to complete and render href='/admin' in the footer
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "footer a[href='/admin']")))
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/admin']"))
    wait_for_path(wait, "/admin")

    # Click Settings in Footer
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "footer a[href='/settings']")))
    click_footer_link(driver, (By.CSS_SELECTOR, "footer a[href='/settings']"))
    wait_for_path(wait, "/settings")

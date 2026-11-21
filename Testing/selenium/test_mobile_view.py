"""Functional (black-box) tests for the mobile view.

Drives a real Chrome browser against the running site, set up as a phone (375 x 812).
Chrome's phone emulation is used instead of resizing the window, because a desktop Chrome
window can't get as narrow as a phone. Nothing is ever saved: the public page tests don't sign in,
and the signed-in tests only look at the pages (the settings form and the admin password popup are
opened but never submitted).

The signed-in tests need a real account (TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD for the
customer pages, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for the admin dashboard) and are skipped without one.
"""
import os

import pytest
from selenium.webdriver.common.by import By

from conftest import button, scroll_and_click, wait_for_path, wait_for_text

CUSTOMER_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")
needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to run the customer tests",
)

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
needs_admin_account = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run the admin tests",
)

PHONE_WIDTH = 375
PHONE_HEIGHT = 812

HAMBURGER = (By.CSS_SELECTOR, "button.hamburger")
NAV = (By.CSS_SELECTOR, "nav.nav")
NAV_OPEN = (By.CSS_SELECTOR, "nav.nav.nav-open")
DESKTOP_BUTTONS = (By.CSS_SELECTOR, ".header-actions")
NAV_LINKS = ["Services", "About", "Testimonials", "Service Areas", "Contact"]

PUBLIC_PAGES = ["/", "/services", "/about", "/testimonials", "/service-area", "/contact", "/signin", "/signup", "/reset-password"]


def set_screen(driver, width, height=PHONE_HEIGHT):
    """Make Chrome act like a phone of this size (touch, device width, meta viewport tag respected)."""
    driver.execute_cdp_cmd(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 2, "mobile": True},
    )


@pytest.fixture
def phone(driver):
    set_screen(driver, PHONE_WIDTH)
    return driver


def open_on_phone(phone, open_page, wait, path):
    open_page(path)
    wait.until(lambda d: d.find_element(By.TAG_NAME, "main"))


def page_width(driver):
    """(width of the page content, width of the screen). The content is wider only if it scrolls sideways."""
    return driver.execute_script("return [document.documentElement.scrollWidth, window.innerWidth]")


def open_menu(phone, wait):
    scroll_and_click(wait, HAMBURGER)
    wait.until(lambda d: d.find_element(*NAV_OPEN).is_displayed())


def test_page_uses_the_phone_width(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/")
    assert phone.execute_script("return window.innerWidth") == PHONE_WIDTH


def test_header_shows_the_hamburger_and_hides_the_desktop_links(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/")
    assert phone.find_element(*HAMBURGER).is_displayed()
    assert not phone.find_element(*NAV).is_displayed()
    assert not phone.find_element(*DESKTOP_BUTTONS).is_displayed()


def test_hamburger_opens_and_closes_the_menu(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/")
    hamburger = phone.find_element(*HAMBURGER)
    assert hamburger.get_attribute("aria-expanded") == "false"

    open_menu(phone, wait)
    assert hamburger.get_attribute("aria-label") == "Close menu"
    assert hamburger.get_attribute("aria-expanded") == "true"
    for label in NAV_LINKS:
        assert phone.find_element(By.LINK_TEXT, label).is_displayed()

    hamburger.click()
    wait.until(lambda d: not d.find_element(*NAV).is_displayed())
    assert hamburger.get_attribute("aria-label") == "Open menu"


def test_menu_link_goes_to_the_page_and_closes_the_menu(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/")
    open_menu(phone, wait)

    scroll_and_click(wait, (By.LINK_TEXT, "Services"))
    wait_for_path(wait, "/services")
    wait.until(lambda d: not d.find_element(*NAV).is_displayed())


def test_menu_has_a_sign_in_button_when_signed_out(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/")
    open_menu(phone, wait)

    scroll_and_click(wait, (By.XPATH, '//nav//button[normalize-space()="Sign In"]'))
    wait_for_path(wait, "/signin")


@pytest.mark.parametrize("path", PUBLIC_PAGES)
def test_page_does_not_scroll_sideways(phone, open_page, wait, path):
    open_on_phone(phone, open_page, wait, path)
    content, screen = page_width(phone)
    assert content <= screen, f"{path} is {content}px wide on a {screen}px screen"


def test_footer_fits_the_screen(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/")
    footer = phone.find_element(By.TAG_NAME, "footer")
    phone.execute_script("arguments[0].scrollIntoView({block: 'end', behavior: 'instant'})", footer)
    assert footer.is_displayed()
    wait_for_text(wait, "All rights reserved")
    right_edge = phone.execute_script("return arguments[0].getBoundingClientRect().right", footer)
    assert right_edge <= PHONE_WIDTH


def test_contact_form_fields_fit_the_screen(phone, open_page, wait):
    open_on_phone(phone, open_page, wait, "/contact")
    # The "website" field is a bot trap, kept off-screen on purpose, so it's skipped
    fields = phone.find_elements(By.CSS_SELECTOR, "form :is(input, select, textarea):not([tabindex='-1'])")
    assert fields
    for field in fields:
        box = phone.execute_script("return arguments[0].getBoundingClientRect()", field)
        label = field.get_attribute("placeholder") or field.get_attribute("name")
        assert box["left"] >= 0 and box["right"] <= PHONE_WIDTH, f"{label} sticks out of the screen"


def test_menu_switches_to_desktop_links_above_the_breakpoint(driver, open_page, wait):
    set_screen(driver, 768)
    open_page("/")
    wait.until(lambda d: d.find_element(By.TAG_NAME, "main"))
    assert driver.find_element(*HAMBURGER).is_displayed()

    set_screen(driver, 1024, 768)
    wait.until(lambda d: d.find_element(*NAV).is_displayed())
    assert not driver.find_element(*HAMBURGER).is_displayed()


# ------------------------------------------------------------------------------
# Signed-in pages
# ------------------------------------------------------------------------------

def sign_in(phone, open_page, wait, email, password):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(email)
    phone.find_element(By.ID, "password").send_keys(password)
    phone.find_element(*button("Sign In")).click()
    wait.until(lambda d: "/signin" not in d.current_url)


def sticks_out(driver, elements):
    """Names of the elements that aren't completely inside the screen."""
    names = []
    for element in elements:
        box = driver.execute_script("return arguments[0].getBoundingClientRect()", element)
        if box["left"] < 0 or box["right"] > PHONE_WIDTH:
            names.append(element.get_attribute("name") or element.get_attribute("id") or element.text)
    return names


@pytest.fixture
def customer_phone(phone, open_page, wait):
    sign_in(phone, open_page, wait, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    wait_for_path(wait, "/portal")
    return phone


@pytest.fixture
def admin_phone(phone, open_page, wait):
    sign_in(phone, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)
    wait_for_path(wait, "/admin")
    wait_for_text(wait, "Admin Portal")
    return phone


@needs_customer_account
def test_customer_portal_fits_the_screen(customer_phone, wait):
    wait_for_text(wait, "Welcome back!")
    content, screen = page_width(customer_phone)
    assert content <= screen, f"/portal is {content}px wide on a {screen}px screen"


@needs_customer_account
def test_settings_page_fits_the_screen(customer_phone, open_page, wait):
    open_page("/settings")
    wait_for_text(wait, "Change User Settings")
    # The button reads "Saving..." until the saved values have loaded
    wait.until(lambda d: d.find_element(*button("Save")).is_enabled())

    content, screen = page_width(customer_phone)
    assert content <= screen, f"/settings is {content}px wide on a {screen}px screen"

    fields = customer_phone.find_elements(By.CSS_SELECTOR, "form input")
    assert fields
    assert sticks_out(customer_phone, fields) == []
    assert sticks_out(customer_phone, [customer_phone.find_element(*button("Save"))]) == []


@needs_customer_account
def test_signed_in_menu_has_dashboard_and_sign_out(customer_phone, open_page, wait):
    open_page("/")
    open_menu(customer_phone, wait)
    assert customer_phone.find_element(By.XPATH, '//nav//button[normalize-space()="Dashboard"]').is_displayed()
    assert customer_phone.find_element(By.XPATH, '//nav//button[normalize-space()="Sign Out"]').is_displayed()
    assert not customer_phone.find_elements(By.XPATH, '//nav//button[normalize-space()="Sign In"]')


@needs_customer_account
def test_menu_dashboard_button_opens_the_portal(customer_phone, open_page, wait):
    open_page("/")
    open_menu(customer_phone, wait)

    scroll_and_click(wait, (By.XPATH, '//nav//button[normalize-space()="Dashboard"]'))
    wait_for_path(wait, "/portal")
    wait.until(lambda d: not d.find_element(*NAV).is_displayed())


@needs_customer_account
def test_menu_sign_out_button_signs_out(customer_phone, open_page, wait):
    open_page("/")
    open_menu(customer_phone, wait)

    scroll_and_click(wait, (By.XPATH, '//nav//button[normalize-space()="Sign Out"]'))
    open_menu(customer_phone, wait)
    wait.until(lambda d: d.find_elements(By.XPATH, '//nav//button[normalize-space()="Sign In"]'))


@needs_admin_account
def test_admin_dashboard_fits_the_screen(admin_phone):
    content, screen = page_width(admin_phone)
    assert content <= screen, f"/admin is {content}px wide on a {screen}px screen"


@needs_admin_account
def test_admin_dashboard_boxes_stack_in_one_column(admin_phone):
    grid = admin_phone.find_element(By.CSS_SELECTOR, ".admin-grid")
    columns = admin_phone.execute_script("return getComputedStyle(arguments[0]).gridTemplateColumns", grid)
    assert len(columns.split()) == 1, f"The boxes are in {len(columns.split())} columns: {columns}"


@needs_admin_account
def test_admin_top_buttons_fit_the_screen(admin_phone):
    nav = admin_phone.find_element(By.CSS_SELECTOR, "nav.admin-nav")
    buttons = nav.find_elements(By.CSS_SELECTOR, "a, button")
    assert [b.text for b in buttons] == ["Home", "Admin Settings", "Sign Out"]
    assert sticks_out(admin_phone, buttons) == []


@needs_admin_account
def test_admin_settings_popup_fits_the_screen_and_closes(admin_phone, wait):
    scroll_and_click(wait, button("Admin Settings"))
    wait_for_text(wait, "Change Admin Password")

    box = admin_phone.find_element(By.CSS_SELECTOR, ".admin-modal-box")
    assert sticks_out(admin_phone, [box]) == []
    fields = box.find_elements(By.CSS_SELECTOR, "input")
    assert len(fields) == 2
    assert sticks_out(admin_phone, fields) == []

    # Cancel closes it without saving anything
    scroll_and_click(wait, button("Cancel"))
    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".admin-modal-box"))

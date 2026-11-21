"""Functional (black-box) tests for the mobile view.

Drives a real Chrome browser against the running site, set up as a phone (375 x 812).
Chrome's phone emulation is used instead of resizing the window, because a desktop Chrome
window can't get as narrow as a phone. Only public pages are visited and nothing is submitted,
so these tests don't need an account and don't save anything.
"""
import pytest
from selenium.webdriver.common.by import By

from conftest import scroll_and_click, wait_for_path, wait_for_text

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

"""SCRUM-239: Real-browser address verification checks on the quote form.

These run against the real validate-address Edge Function, so most of them spend a
Geocodio lookup. The function allows 10 checks a minute per IP, and a full run stays
under that. Default tests save nothing. Tests that save a real quote are opt-in;
delete the "Selenium Test 239" rows from the quotes table after running them.
"""
import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select

from conftest import button, wait_for_text

needs_quote_saving = pytest.mark.skipif(
    os.environ.get("RUN_QUOTE_SAVE_TESTS") != "1",
    reason="Set RUN_QUOTE_SAVE_TESTS=1 to save real quotes, then delete the rows afterwards",
)

SUBMIT = "Get My Free Quote"
REAL_STREET = "1315 10th St"
FAKE_STREET = "99999 Fakestreet Blvd"
INVALID_MESSAGE = "We couldn't verify this address. Please check it and try again."
SUCCESS_MESSAGE = "We've received your quote request"


def field(driver, name):
    return driver.find_element(By.CSS_SELECTOR, f"form.contact-form [name='{name}']")


def fill_quote_form(driver, wait, street=REAL_STREET, city="Sacramento", zip_code="95814"):
    wait.until(lambda d: field(d, "customerName"))
    field(driver, "customerName").send_keys("Selenium Test 239")
    field(driver, "email").send_keys("prasad.testers2026@gmail.com")
    field(driver, "phone").send_keys("9165550123")
    driver.find_element(By.ID, "quote-address-street").send_keys(street)
    driver.find_element(By.ID, "quote-address-city").send_keys(city)
    driver.find_element(By.ID, "quote-address-zip").send_keys(zip_code)
    Select(field(driver, "propertyType")).select_by_visible_text("Residential")
    Select(field(driver, "serviceType")).select_by_visible_text("Standard Cleaning")
    field(driver, "message").send_keys("Automated test, please delete")


def click_button(driver, label):
    """Jump straight to the button: the site scrolls smoothly, and the form is far down the page."""
    element = driver.find_element(*button(label))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'})", element)
    element.click()


def erase(element):
    """Backspace like a user would: element.clear() doesn't trigger React's onChange."""
    element.send_keys(Keys.BACKSPACE * len(element.get_attribute("value")))


def test_quote_form_starts_with_california_and_length_limits(driver, open_page, wait):
    open_page("/contact")
    state = wait.until(lambda d: d.find_element(By.ID, "quote-address-state"))

    assert state.get_attribute("value") == "CA"
    assert state.get_attribute("maxlength") == "2"
    assert driver.find_element(By.ID, "quote-address-zip").get_attribute("maxlength") == "5"


def test_submit_is_enabled_without_a_unit_but_not_without_a_street(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait)
    assert driver.find_element(*button(SUBMIT)).is_enabled()

    erase(driver.find_element(By.ID, "quote-address-street"))
    wait.until(lambda d: not d.find_element(*button(SUBMIT)).is_enabled())


def test_short_zip_is_stopped_before_a_lookup(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait, zip_code="958")

    click_button(driver, SUBMIT)

    wait_for_text(wait, "Please enter a 5-digit ZIP code.")


def test_unknown_state_is_stopped_before_a_lookup(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait)
    state = driver.find_element(By.ID, "quote-address-state")
    erase(state)
    state.send_keys("ZZ")

    click_button(driver, SUBMIT)

    wait_for_text(wait, "Please enter the 2-letter state (for example CA).")


@pytest.mark.parametrize("path", ["/contact"])
def test_made_up_street_is_blocked(driver, open_page, wait, path):
    open_page(path)
    fill_quote_form(driver, wait, street=FAKE_STREET)

    click_button(driver, SUBMIT)

    wait_for_text(wait, INVALID_MESSAGE)
    assert driver.find_element(By.ID, "quote-address-street").get_attribute("value") == FAKE_STREET


def test_po_box_is_blocked(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait, street="PO Box 12")

    click_button(driver, SUBMIT)

    wait_for_text(wait, INVALID_MESSAGE)


def test_wrong_zip_offers_the_corrected_address(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait, zip_code="95811")

    click_button(driver, SUBMIT)

    wait_for_text(wait, "Did you mean:")
    suggestion = driver.find_element(By.CSS_SELECTOR, "[role='alert'] strong").text
    assert suggestion == "1315 10th St, Sacramento, CA 95814"


def test_edit_my_address_closes_the_suggestion_and_keeps_the_input(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait, zip_code="95811")
    click_button(driver, SUBMIT)
    wait_for_text(wait, "Did you mean:")

    click_button(driver, "Edit my address")

    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, "[role='alert']"))
    assert driver.find_element(By.ID, "quote-address-zip").get_attribute("value") == "95811"


@needs_quote_saving
@pytest.mark.parametrize("street", [REAL_STREET, "1315 10th Street"])
def test_real_address_saves_the_quote(driver, open_page, wait, street):
    open_page("/contact")
    fill_quote_form(driver, wait, street=street)

    click_button(driver, SUBMIT)

    wait_for_text(wait, SUCCESS_MESSAGE)
    assert driver.find_element(By.ID, "quote-address-street").get_attribute("value") == ""


@needs_quote_saving
def test_use_this_address_saves_the_quote(driver, open_page, wait):
    open_page("/contact")
    fill_quote_form(driver, wait, zip_code="95811")
    click_button(driver, SUBMIT)
    wait_for_text(wait, "Did you mean:")

    click_button(driver, "Use this address")

    wait_for_text(wait, SUCCESS_MESSAGE)

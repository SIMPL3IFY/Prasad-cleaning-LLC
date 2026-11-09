"""Functional (black-box) tests for the Settings page (SCRUM-250).

Drives a real Chrome browser against the running site, the way a signed-in user would use it.
These use the real Supabase project, so every test stops before anything is saved: each check
either only looks at the page or fills in a bad value, and the page's own validation blocks it
before an email, phone number, address or password is sent. A successful save is covered by
the unit tests, which fake Supabase.

The signed-in tests need a real account (TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD).
"""
import os

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from conftest import button, scroll_and_click, wait_for_path, wait_for_text

ACCOUNT_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
ACCOUNT_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")
needs_account = pytest.mark.skipif(
    not (ACCOUNT_EMAIL and ACCOUNT_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to a real account",
)

SAVE = button("Save")


def field(driver, field_id):
    return driver.find_element(By.ID, field_id)


def replace_text(element, text):
    """Select the field's content and type over it, the way a user would (clear() skips React's change event)."""
    element.click()
    for _ in range(len(element.get_attribute("value"))):
        element.send_keys(Keys.BACKSPACE)
    element.send_keys(text)


def click_save(driver):
    save = driver.find_element(*SAVE)
    # behavior 'instant' overrides the site's smooth scrolling, so the click doesn't land mid-scroll
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'})", save)
    save.click()


@pytest.fixture
def settings_page(driver, open_page, wait):
    """Sign in, open /settings and wait until the saved values have loaded."""
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email"))
    field(driver, "email").send_keys(ACCOUNT_EMAIL)
    field(driver, "password").send_keys(ACCOUNT_PASSWORD)
    driver.find_element(*button("Sign In")).click()
    wait_for_path(wait, "/portal")

    open_page("/settings")
    # The button reads "Saving..." until the saved values have loaded
    wait.until(lambda d: d.find_element(*SAVE).is_enabled())
    return driver


def test_signed_out_visitor_is_sent_to_sign_in(driver, open_page, wait):
    open_page("/settings")

    wait_for_path(wait, "/signin")
    wait_for_text(wait, "Access your account")


@needs_account
def test_page_shows_the_heading_fields_save_and_cancel(settings_page):
    driver = settings_page

    assert driver.find_element(By.TAG_NAME, "h2").text == "Change User Settings"
    for field_id in ["email", "phone", "address", "password", "confirmPassword"]:
        assert field(driver, field_id).is_displayed()
    assert driver.find_element(*SAVE).is_displayed()
    assert driver.find_element(By.LINK_TEXT, "Cancel").get_attribute("href").endswith("/portal")


@needs_account
def test_email_field_shows_the_signed_in_email(settings_page):
    assert field(settings_page, "email").get_attribute("value").lower() == ACCOUNT_EMAIL.strip().lower()


@needs_account
def test_save_with_no_changes_asks_for_a_change(settings_page, wait):
    click_save(settings_page)

    wait_for_text(wait, "Make a change before saving.")


@needs_account
def test_email_is_read_only_until_clicked_and_cancel_restores_it(settings_page, wait):
    driver = settings_page
    email = field(driver, "email")
    original = email.get_attribute("value")
    assert email.get_attribute("readonly")

    email.click()
    assert not email.get_attribute("readonly")

    email.send_keys("x")
    driver.find_element(*button("Cancel email edit")).click()

    assert email.get_attribute("value") == original
    assert email.get_attribute("readonly")


@needs_account
def test_empty_email_shows_an_error(settings_page, wait):
    driver = settings_page
    replace_text(field(driver, "email"), "")

    click_save(driver)

    wait_for_text(wait, "Email is required.")


@needs_account
def test_invalid_email_shows_an_error(settings_page, wait):
    driver = settings_page
    replace_text(field(driver, "email"), "not-an-email")

    click_save(driver)

    wait_for_text(wait, "Please enter a valid email address.")


@needs_account
def test_phone_without_ten_digits_shows_an_error(settings_page, wait):
    driver = settings_page
    replace_text(field(driver, "phone"), "12345")

    click_save(driver)

    wait_for_text(wait, "Enter a valid 10-digit US phone number.")


@needs_account
def test_passwords_that_do_not_match_show_an_error(settings_page, wait):
    driver = settings_page
    field(driver, "password").send_keys("NewPass123!")
    field(driver, "confirmPassword").send_keys("Different456!")

    click_save(driver)

    wait_for_text(wait, "Passwords do not match.")


@needs_account
def test_eye_buttons_show_and_hide_each_password_field(settings_page):
    driver = settings_page
    password = field(driver, "password")
    confirm = field(driver, "confirmPassword")
    assert password.get_attribute("type") == "password"
    assert confirm.get_attribute("type") == "password"

    toggle_new, toggle_confirm = driver.find_elements(By.CSS_SELECTOR, 'button[aria-label="Show password"]')

    # Only the field whose button was clicked changes
    toggle_new.click()
    assert password.get_attribute("type") == "text"
    assert confirm.get_attribute("type") == "password"
    assert len(driver.find_elements(By.CSS_SELECTOR, 'button[aria-label="Hide password"]')) == 1

    toggle_confirm.click()
    assert confirm.get_attribute("type") == "text"

    driver.find_element(By.CSS_SELECTOR, 'button[aria-label="Hide password"]').click()
    assert password.get_attribute("type") == "password"


@needs_account
def test_cancel_goes_back_to_the_portal(settings_page, wait):
    scroll_and_click(wait, (By.LINK_TEXT, "Cancel"))

    wait_for_path(wait, "/portal")

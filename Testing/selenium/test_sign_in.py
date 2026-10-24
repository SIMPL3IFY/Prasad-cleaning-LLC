"""Functional (black-box) tests for customer sign in.

Drives a real Chrome browser against the running site, the way a customer would use it.
"""
import os
import uuid

import pytest
from selenium.webdriver.common.by import By

from conftest import button, scroll_and_click, validation_message, wait_for_path, wait_for_text

CUSTOMER_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")
needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to a real customer account",
)


def fill_sign_in(driver, email, password):
    driver.find_element(By.ID, "email").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(*button("Sign In")).click()


def test_sign_in_page_shows_the_form(driver, open_page, wait):
    open_page("/signin")

    wait_for_text(wait, "Access your account")
    assert driver.find_element(By.ID, "email").is_displayed()
    assert driver.find_element(By.ID, "password").is_displayed()
    assert driver.find_element(*button("Sign In")).is_displayed()
    assert driver.find_element(By.LINK_TEXT, "Forgot password?").is_displayed()


def test_empty_form_is_not_submitted(driver, open_page, wait):
    open_page("/signin")
    email = wait.until(lambda d: d.find_element(By.ID, "email"))

    driver.find_element(*button("Sign In")).click()

    assert validation_message(driver, email) != ""
    assert driver.current_url.endswith("/signin")


def test_email_without_at_sign_is_blocked_by_the_browser(driver, open_page, wait):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email"))

    fill_sign_in(driver, "not-an-email", "secret123")

    assert validation_message(driver, driver.find_element(By.ID, "email")) != ""
    assert driver.current_url.endswith("/signin")


def test_email_without_domain_ending_shows_an_error(driver, open_page, wait):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email"))

    # "user@example" gets past the browser's check, so the site's own check must catch it
    fill_sign_in(driver, "user@example", "secret123")

    wait_for_text(wait, "Please enter a valid email address.")


def test_wrong_credentials_show_an_error(driver, open_page, wait):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email"))

    fill_sign_in(driver, f"no-account-{uuid.uuid4().hex[:8]}@example.com", "WrongPass!123")

    wait_for_text(wait, "Invalid login credentials")
    assert driver.current_url.endswith("/signin")


def test_password_can_be_shown_and_hidden(driver, open_page, wait):
    open_page("/signin")
    password = wait.until(lambda d: d.find_element(By.ID, "password"))

    assert password.get_attribute("type") == "password"
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Show password']").click()
    assert password.get_attribute("type") == "text"
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Hide password']").click()
    assert password.get_attribute("type") == "password"


def test_sign_up_button_goes_to_sign_up(driver, open_page, wait):
    open_page("/signin")
    wait.until(lambda d: d.find_element(*button("Sign Up"))).click()
    wait_for_path(wait, "/signup")


def test_create_one_link_goes_to_sign_up(driver, open_page, wait):
    open_page("/signin")
    # The link sits near the bottom of the page, so scroll to it like a user would
    scroll_and_click(wait, (By.LINK_TEXT, "Create one"))
    wait_for_path(wait, "/signup")


@needs_customer_account
def test_customer_signs_in_and_reaches_the_portal(driver, open_page, wait):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email"))

    fill_sign_in(driver, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)

    wait_for_path(wait, "/portal")


@needs_customer_account
def test_email_with_capitals_and_spaces_still_signs_in(driver, open_page, wait):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email"))

    fill_sign_in(driver, f"  {CUSTOMER_EMAIL.upper()}  ", CUSTOMER_PASSWORD)

    wait_for_path(wait, "/portal")

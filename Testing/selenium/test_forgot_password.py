"""SCRUM-231: Real-browser password recovery checks using the shared Selenium helpers.

Default tests do not request emails or update passwords. One email-request test
is explicitly opt-in; actual delivery and password replacement require the manual
inbox checklist in Testing/forgotPasswordTest/README.md.
"""
import os

import pytest
from selenium.webdriver.common.by import By

from conftest import button, scroll_and_click, validation_message, wait_for_path, wait_for_text

RESET_EMAIL = os.environ.get("TEST_RESET_EMAIL", "")
send_email_enabled = os.environ.get("RUN_RESET_EMAIL_TEST") == "1" and bool(RESET_EMAIL)


def open_forgot_form(driver, open_page, wait):
    open_page("/signin")
    scroll_and_click(wait, (By.LINK_TEXT, "Forgot password?"))
    return wait.until(lambda d: d.find_element(By.ID, "reset-email"))


def test_forgot_password_opens_the_reset_form(driver, open_page, wait):
    email = open_forgot_form(driver, open_page, wait)
    assert email.is_displayed()
    assert driver.find_element(*button("Send Reset Link")).is_displayed()
    assert not driver.find_elements(By.ID, "password")


def test_forgot_password_requires_an_email(driver, open_page, wait):
    email = open_forgot_form(driver, open_page, wait)
    driver.find_element(*button("Send Reset Link")).click()
    assert validation_message(driver, email) != ""
    assert driver.current_url.endswith("/signin")


def test_forgot_password_blocks_bad_email_format_in_the_browser(driver, open_page, wait):
    email = open_forgot_form(driver, open_page, wait)
    email.send_keys("not-an-email")
    driver.find_element(*button("Send Reset Link")).click()
    assert validation_message(driver, email) != ""


def test_forgot_password_checks_the_email_domain_in_the_app(driver, open_page, wait):
    email = open_forgot_form(driver, open_page, wait)
    email.send_keys("customer@example")
    driver.find_element(*button("Send Reset Link")).click()
    wait_for_text(wait, "Please enter a valid email address.")


def test_back_to_sign_in_clears_reset_feedback(driver, open_page, wait):
    email = open_forgot_form(driver, open_page, wait)
    email.send_keys("customer@example")
    driver.find_element(*button("Send Reset Link")).click()
    wait_for_text(wait, "Please enter a valid email address.")
    scroll_and_click(wait, (By.LINK_TEXT, "Back to Sign In"))
    wait.until(lambda d: d.find_element(By.ID, "password"))
    scroll_and_click(wait, (By.LINK_TEXT, "Forgot password?"))
    email = wait.until(lambda d: d.find_element(By.ID, "reset-email"))
    assert email.get_attribute("value") == ""
    assert not driver.find_elements(By.CSS_SELECTOR, "[role='alert']")


def test_reset_page_without_a_recovery_link_is_blocked(driver, open_page, wait):
    open_page("/reset-password")
    wait_for_text(wait, "This password-reset link is invalid or has expired.")
    assert not driver.find_elements(By.ID, "new-password")
    scroll_and_click(wait, (By.LINK_TEXT, "Return to Sign In"))
    wait_for_path(wait, "/signin")


def test_confirmation_page_without_a_token_is_blocked(driver, open_page, wait):
    open_page("/reset-password/continue")
    wait_for_text(wait, "This password-reset link is invalid.")
    assert not driver.find_elements(*button("Continue"))


def test_confirmation_page_rejects_a_malformed_token_and_removes_it(driver, open_page, wait):
    open_page("/reset-password/continue#token_hash=bad%20token")
    wait_for_text(wait, "This password-reset link is invalid.")
    assert "#" not in driver.current_url
    assert not driver.find_elements(*button("Continue"))


@pytest.mark.skipif(
    not send_email_enabled,
    reason="Set RUN_RESET_EMAIL_TEST=1 and TEST_RESET_EMAIL to an inbox/account you control",
)
def test_reset_request_shows_confirmation_for_a_controlled_account(driver, open_page, wait):
    """One real email request; success on screen alone does not prove email delivery."""
    email = open_forgot_form(driver, open_page, wait)
    email.send_keys(RESET_EMAIL)
    driver.find_element(*button("Send Reset Link")).click()
    wait_for_text(wait, "If an account exists for that email, a reset link has been sent.")
    assert driver.find_element(By.ID, "reset-email").get_attribute("value") == ""

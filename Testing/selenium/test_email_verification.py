"""Functional (black-box) tests for the email confirmation page (SCRUM-254).

Drives a real Chrome browser against the running site, the way a customer would use it.
A successful confirmation needs a link from a real sign-up email, so these cover the
failure paths only. The success path is covered by the unit tests.
"""
from selenium.webdriver.common.by import By

from conftest import wait_for_path, wait_for_text

EXPIRED_LINK_HASH = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
TIMEOUT_MESSAGE = "This confirmation link is invalid or has expired."


def heading(driver):
    return driver.find_element(By.CSS_SELECTOR, ".signin-card h1").text


def test_expired_link_shows_the_error(driver, open_page, wait):
    open_page(f"/auth/callback{EXPIRED_LINK_HASH}")

    wait.until(lambda d: heading(d) == "Confirmation failed")
    assert driver.find_element(By.CSS_SELECTOR, "[role='alert']").text == "Email link is invalid or has expired"


def test_link_without_a_sign_in_fails_after_waiting(driver, open_page, wait):
    open_page("/auth/callback")

    wait.until(lambda d: heading(d) == "Confirming your email...")
    # The page gives Supabase 5 seconds to sign the customer in; the default wait is 10
    wait_for_text(wait, TIMEOUT_MESSAGE)
    assert heading(driver) == "Confirmation failed"


def test_go_to_sign_in_after_a_failed_link(driver, open_page, wait):
    open_page(f"/auth/callback{EXPIRED_LINK_HASH}")
    wait_for_text(wait, "to request a new confirmation email")

    driver.find_element(By.LINK_TEXT, "Go to Sign In").click()

    wait_for_path(wait, "/signin")

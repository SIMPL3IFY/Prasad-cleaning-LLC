"""SCRUM-228 browser tests for customer account creation.

These tests use the Selenium-only in-memory Supabase mock configured by
Testing/selenium/vite.config.js. They do not create real accounts or send
confirmation emails.
"""
from urllib.parse import urlparse

import pytest
from selenium.webdriver.common.by import By

from conftest import BASE_URL, button, scroll_and_click, wait_for_text


@pytest.fixture(autouse=True)
def require_local_mock_server():
    host = urlparse(BASE_URL).hostname
    if host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail(
            "SCRUM-228 Selenium tests require the local mock Vite server. "
            "Set BASE_URL to http://127.0.0.1:5173; do not use production."
        )


def fill_valid_sign_up_form(driver):
    driver.find_element(By.ID, "name").send_keys("Selenium Test Customer")
    driver.find_element(By.ID, "email").send_keys("selenium-signup@example.test")
    driver.find_element(By.ID, "password").send_keys("ValidPass1!")
    driver.find_element(By.ID, "confirmPassword").send_keys("ValidPass1!")


def open_sign_up_with_mock(driver, open_page, wait):
    open_page("/signup")
    wait_for_text(wait, "Create an account to get started.")
    if not driver.execute_script("return Boolean(window.__SCRUM228_MOCK__)"):
        pytest.fail(
            "The SCRUM-228 mock is not active. Start Vite with "
            "Testing/selenium/vite.config.js before entering registration data."
        )


def test_valid_sign_up_shows_email_confirmation(driver, open_page, wait):
    open_sign_up_with_mock(driver, open_page, wait)
    fill_valid_sign_up_form(driver)
    scroll_and_click(wait, button("Sign Up"))

    wait_for_text(wait, "Confirm your email")
    assert (
        "Account created. We sent a confirmation link to "
        "selenium-signup@example.test."
        in driver.find_element(By.CSS_SELECTOR, "[role='status']").text
    )

    calls = driver.execute_script(
        "return window.__SCRUM228_MOCK__.signUpCalls"
    )
    assert len(calls) == 1
    assert calls[0]["email"] == "selenium-signup@example.test"
    assert calls[0]["password"] == "ValidPass1!"
    assert calls[0]["options"]["data"]["full_name"] == "Selenium Test Customer"
    assert calls[0]["options"]["emailRedirectTo"] == (
        f"{driver.execute_script('return window.location.origin')}/auth/callback"
    )


def test_invalid_sign_up_input_shows_validation_without_request(
    driver, open_page, wait
):
    open_sign_up_with_mock(driver, open_page, wait)

    driver.find_element(By.ID, "name").send_keys("Selenium Test Customer")
    driver.find_element(By.ID, "email").send_keys("not-an-email")
    driver.find_element(By.ID, "password").send_keys("short")
    driver.find_element(By.ID, "confirmPassword").send_keys("different")
    scroll_and_click(wait, button("Sign Up"))

    wait_for_text(wait, "Please enter a valid email address")
    body_text = driver.find_element(By.TAG_NAME, "body").text
    assert "Password must be at least 8 characters" in body_text
    assert "Passwords do not match" in body_text
    assert driver.execute_script(
        "return window.__SCRUM228_MOCK__.signUpCalls.length"
    ) == 0


def test_registration_error_is_displayed(driver, open_page, wait):
    open_sign_up_with_mock(driver, open_page, wait)
    driver.execute_script(
        "window.__SCRUM228_MOCK__.signUpError = "
        "{ message: 'Unable to create account right now.' }"
    )
    fill_valid_sign_up_form(driver)
    scroll_and_click(wait, button("Sign Up"))

    wait_for_text(wait, "Unable to create account right now.")
    assert driver.find_element(
        By.XPATH, "//h1[normalize-space()='Sign Up']"
    ).is_displayed()
    assert driver.execute_script(
        "return window.__SCRUM228_MOCK__.signUpCalls.length"
    ) == 1
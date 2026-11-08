"""Browser tests for customer portal access (SCRUM-251).

These tests must use a local Vite site and a dedicated test Supabase project.
They do not submit reviews, appointments, quotes, or other customer changes.
"""
import os
from urllib.parse import urlparse

import pytest
from selenium.webdriver.common.by import By

from conftest import BASE_URL, button, wait_for_path


CUSTOMER_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")

needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD for the test customer",
)

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


@pytest.fixture(autouse=True)
def require_local_vite_site():
    """Stop these tests from accidentally targeting a remote or production site."""
    host = urlparse(BASE_URL).hostname

    if host not in LOCAL_HOSTS:
        pytest.fail(
            "SCRUM-251 Selenium tests only run against a local Vite server. "
            "Set BASE_URL to http://localhost:5173; do not use production."
        )


def test_signed_out_visitor_cannot_open_customer_portal(driver, open_page, wait):
    open_page("/portal")

    wait_for_path(wait, "/signin")

    sign_in_heading = wait.until(
        lambda current: current.find_element(
            By.XPATH,
            "//h1[contains(., 'Sign In')]",
        )
    )

    assert sign_in_heading.is_displayed()
    assert driver.find_elements(
        By.XPATH,
        "//h1[normalize-space()='Welcome back!']",
    ) == []


@needs_customer_account
def test_customer_signs_in_and_reaches_portal(driver, open_page, wait):
    open_page("/signin")

    wait.until(
        lambda current: current.find_element(By.ID, "email")
    ).send_keys(CUSTOMER_EMAIL)

    driver.find_element(By.ID, "password").send_keys(CUSTOMER_PASSWORD)
    driver.find_element(*button("Sign In")).click()

    wait_for_path(wait, "/portal")

    welcome_heading = wait.until(
        lambda current: current.find_element(
            By.XPATH,
            "//h1[normalize-space()='Welcome back!']",
        )
    )

    assert welcome_heading.is_displayed()
    assert driver.find_element(*button("Sign Out")).is_displayed()
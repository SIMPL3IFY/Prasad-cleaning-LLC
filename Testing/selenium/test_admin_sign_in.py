"""Functional (black-box) tests for admin sign in (SCRUM-236).

Drives a real Chrome browser against the running site, the way an admin would use it.
"""
import os

import pytest
from selenium.webdriver.common.by import By

from conftest import BASE_URL, button, wait_for_path, wait_for_text

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
needs_admin_account = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to a real admin account",
)

CUSTOMER_EMAIL = os.environ.get("TEST_CUSTOMER_EMAIL")
CUSTOMER_PASSWORD = os.environ.get("TEST_CUSTOMER_PASSWORD")
needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to a real customer account",
)

SIGNED_OUT_MESSAGE = "Please sign in with an administrator account."
FORBIDDEN_MESSAGE = "Access denied. This account is not an administrator."


def sign_in(driver, open_page, wait, email, password):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(*button("Sign In")).click()


def test_signed_out_visitor_is_sent_to_sign_in(driver, open_page, wait):
    open_page("/admin")

    wait_for_path(wait, "/signin")
    wait_for_text(wait, SIGNED_OUT_MESSAGE)


@needs_admin_account
def test_admin_signs_in_and_reaches_the_dashboard(driver, open_page, wait):
    sign_in(driver, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)

    wait_for_path(wait, "/admin")
    assert wait.until(lambda d: d.find_element(*button("Sign Out"))).is_displayed()


@needs_admin_account
def test_admin_signs_out_and_loses_access(driver, open_page, wait):
    sign_in(driver, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)
    wait_for_path(wait, "/admin")

    wait.until(lambda d: d.find_element(*button("Sign Out"))).click()
    # Sign Out returns the admin to the home page
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)

    open_page("/admin")
    wait_for_path(wait, "/signin")
    wait_for_text(wait, SIGNED_OUT_MESSAGE)


@needs_customer_account
def test_customer_is_denied_the_dashboard(driver, open_page, wait):
    sign_in(driver, open_page, wait, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    wait_for_path(wait, "/portal")

    open_page("/admin")
    wait_for_path(wait, "/signin")
    wait_for_text(wait, FORBIDDEN_MESSAGE)

"""SCRUM-246 browser tests against the Vite server's in-memory mocks."""
from urllib.parse import urlparse

import pytest
from selenium.webdriver.common.by import By

from conftest import BASE_URL, button, wait_for_text

@pytest.fixture(autouse=True)
def require_local_test_server():
    host = urlparse(BASE_URL).hostname

    if host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail(
            "SCRUM-246 Selenium tests require the local mock Vite server; "
            "BASE_URL must use localhost or 127.0.0.1"
        )

def open_review_form(driver, wait, open_page):
    open_page("/portal")

    if not driver.execute_script("return Boolean(window.__SCRUM246_MOCK__)"):
        pytest.fail(
            "The in-memory SCRUM-246 mock is not active. Start Vite with "
            "--config Testing/selenium/vite.config.js before running this test."
        )
    wait_for_text(wait, "Welcome back!")

    driver.find_element(
        By.XPATH,
        "//button[.//span[normalize-space()='Leave a Review']]",
    ).click()

    wait_for_text(wait, "Write a Review")

def test_customer_can_submit_review_to_in_memory_mock(driver, wait, open_page):
    open_review_form(driver, wait, open_page)

    driver.find_element(By.NAME, "customerName").send_keys("Selenium Test Customer")
    driver.find_element(By.NAME, "reviewText").send_keys("The service was excellent.")
    driver.find_element(By.CSS_SELECTOR, "[data-testid='review-rating-5']").click()
    driver.find_element(*button("Send")).click()

    wait_for_text(wait, "Review submitted and awaiting approval.")

    inserted = driver.execute_script("return window.__SCRUM246_MOCK__.insertedReviews")

    assert inserted == [{
        "user_id": "selenium-customer-246",
        "customer_name": "Selenium Test Customer",
        "review": "The service was excellent.",
        "rating": 5,
        "approved": False,
    }]

def test_empty_review_shows_validation_without_an_insert(driver, wait, open_page):
    open_review_form(driver, wait, open_page)

    driver.find_element(*button("Send")).click()

    wait_for_text(wait, "Please enter your name.")
    wait.until(lambda d: "Please enter a review" in d.find_element(By.TAG_NAME, "body").text)
    wait_for_text(wait, "Please select a star rating")

    inserted = driver.execute_script("return window.__SCRUM246_MOCK__.insertedReviews")
    assert inserted == []

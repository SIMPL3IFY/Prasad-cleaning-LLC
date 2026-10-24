import os

import pytest
from selenium import webdriver
from selenium.common.exceptions import ElementClickInterceptedException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# Where the site is running (start it first with `npm run dev`)
BASE_URL = os.environ.get("BASE_URL", "http://localhost:5173").rstrip("/")


@pytest.fixture
def driver():
    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS") == "1":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1280,900")

    # Selenium 4 finds or downloads the ChromeDriver that matches your Chrome version
    driver = webdriver.Chrome(options=options)
    yield driver
    driver.quit()


@pytest.fixture
def open_page(driver):
    def _open(path):
        driver.get(f"{BASE_URL}{path}")
    return _open


@pytest.fixture
def wait(driver):
    return WebDriverWait(driver, 10)


def text_on_page(text):
    """Locator for any element whose text contains `text`."""
    return (By.XPATH, f"//*[contains(normalize-space(.), \"{text}\") and not(*[contains(normalize-space(.), \"{text}\")])]")


def button(label):
    return (By.XPATH, f"//button[normalize-space()=\"{label}\"]")


def wait_for_text(wait, text):
    return wait.until(EC.visibility_of_element_located(text_on_page(text)))


def wait_for_path(wait, path):
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/").endswith(path))


def scroll_and_click(wait, locator):
    """Scroll an element into view and click it, retrying while the page is still settling."""
    def _click(driver):
        element = driver.find_element(*locator)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'})", element)
        try:
            element.click()
            return True
        except ElementClickInterceptedException:
            return False
    wait.until(_click)


def validation_message(driver, element):
    """The browser's built-in validation message ("Please fill out this field.", etc.)."""
    return driver.execute_script("return arguments[0].validationMessage", element)

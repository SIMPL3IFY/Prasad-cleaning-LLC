"""Functional (black-box) tests for the Admin Dashboard (SCRUM-230).

Drives a real Chrome browser against the running site and the real Supabase database,
the way an admin would use it. Sign in and sign out are covered in test_admin_sign_in.py.

Most tests only look at the page or click Cancel, so they save nothing. The quote lifecycle
test changes data and only runs when ALLOW_DATA_CHANGES=1 and TEST_QUOTE_NAME are set.
"""
import os
import time

import pytest
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import button, scroll_and_click, wait_for_path, wait_for_text

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")
# SCRUM-230: every test in this file needs the admin account
pytestmark = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to a real admin account",
)

# SCRUM-230: only the lifecycle test changes data, and only on a quote you submitted yourself
TEST_QUOTE_NAME = os.environ.get("TEST_QUOTE_NAME")
allows_data_changes = pytest.mark.skipif(
    not (os.environ.get("ALLOW_DATA_CHANGES") == "1" and TEST_QUOTE_NAME),
    reason="Set ALLOW_DATA_CHANGES=1 and TEST_QUOTE_NAME to the name on a quote you submitted",
)

DASHBOARD_BOXES = [
    "Completed Appointments", "Manage Appointments", "Manage Quotes",
    "Declined Quotes", "Customer Reviews", "Edit Services",
]


# ---------- SCRUM-230 helpers ----------

def panel(driver, title):
    """The dashboard box whose <h2> heading is `title`."""
    return driver.find_element(
        By.XPATH,
        f"//h2[normalize-space()='{title}']"
        "/ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' admin-panel ')][1]",
    )


def panel_text(driver, title):
    """The box's visible text, or '' while React is re-rendering it."""
    try:
        return panel(driver, title).text
    except (NoSuchElementException, StaleElementReferenceException):
        return ""


def wait_for_panel_text(driver, title, text, timeout=10):
    WebDriverWait(driver, timeout).until(lambda d: text in panel_text(d, title))


def click_in_panel(wait, title, label):
    """Click a button inside one box, retrying while the page re-renders.
    The leading '.' in the XPath keeps the search inside the box
    (conftest's button() searches the whole page)."""
    def _click(d):
        try:
            element = panel(d, title).find_element(By.XPATH, f".//button[normalize-space()=\"{label}\"]")
            d.execute_script("arguments[0].scrollIntoView({block: 'center'})", element)
            element.click()
            return True
        except (NoSuchElementException, StaleElementReferenceException, ElementClickInterceptedException):
            return False
    wait.until(_click)


def require_card(driver, title, button_label, what):
    """Give the real data up to 5 seconds to load; skip the test if the box is empty."""
    try:
        WebDriverWait(driver, 5).until(lambda d: button_label_in_panel(d, title, button_label))
    except TimeoutException:
        pytest.skip(f"No {what} in the database right now")


def button_label_in_panel(driver, title, label):
    try:
        return panel(driver, title).find_elements(By.XPATH, f".//button[normalize-space()=\"{label}\"]")
    except (NoSuchElementException, StaleElementReferenceException):
        return []


def open_search(wait, text=None):
    scroll_and_click(wait, button("Search Quotes By"))
    if text is not None:
        field = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "input[placeholder^='Search by']"))
        field.send_keys(text)


def accept_alert_if_shown(driver):
    """Cancelling an appointment shows an alert() if the emails fail; close it so the test can continue."""
    try:
        WebDriverWait(driver, 3).until(EC.alert_is_present())
        driver.switch_to.alert.accept()
    except TimeoutException:
        pass


@pytest.fixture
def dashboard(driver, open_page, wait):
    """Signs in as the test admin and waits for the dashboard."""
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(ADMIN_EMAIL)
    driver.find_element(By.ID, "password").send_keys(ADMIN_PASSWORD)
    driver.find_element(*button("Sign In")).click()
    wait_for_path(wait, "/admin")
    wait.until(lambda d: d.find_element(By.XPATH, "//h2[normalize-space()='Manage Quotes']"))
    return driver


# ---------- Read-only tests: nothing is saved ----------

def test_every_box_loads_without_errors(dashboard):
    for title in DASHBOARD_BOXES:
        assert dashboard.find_element(By.XPATH, f"//h2[normalize-space()='{title}']").is_displayed(), title

    # Let the real Supabase queries finish, then check none of them failed.
    # This is the check the unit tests can't do: the real RLS policies let the admin read each table.
    time.sleep(3)
    errors = dashboard.find_elements(By.XPATH, "//*[@role='alert'][contains(., 'Unable to load')]")
    assert errors == [], [e.text for e in errors]


def test_reviews_popup_opens_and_closes(dashboard, wait):
    scroll_and_click(wait, button("View Review Table"))
    wait.until(EC.visibility_of_element_located((By.XPATH, "//h3[normalize-space()='Customer Reviews']")))
    wait.until(lambda d: "Loading reviews..." not in d.find_element(By.CLASS_NAME, "admin-modal-box").text)

    popup = dashboard.find_element(By.CLASS_NAME, "admin-modal-box").text
    assert "Pending Reviews" in popup or "No reviews available." in popup

    scroll_and_click(wait, button("×"))
    wait.until(EC.invisibility_of_element_located((By.XPATH, "//h3[normalize-space()='Customer Reviews']")))


def test_search_with_no_match_empties_every_box(dashboard, wait):
    query = "zz-no-match-230"
    open_search(wait, query)

    wait_for_panel_text(dashboard, "Manage Quotes", f"No appointments found matching '{query}'.")
    wait_for_panel_text(dashboard, "Manage Appointments", f"No appointments found matching '{query}'.")
    wait_for_panel_text(dashboard, "Declined Quotes", f"No appointments found matching '{query}'.")
    wait_for_panel_text(dashboard, "Completed Appointments", f"No completed appointments found matching '{query}'.")

    scroll_and_click(wait, button("Hide Search"))
    wait.until(lambda d: d.find_element(*button("Search Quotes By")))


def test_time_category_shows_a_time_picker(dashboard, wait):
    # Scrum 219: the Appointment Time category swaps the text box for a time picker
    open_search(wait)
    scroll_and_click(wait, (By.XPATH, "//button[starts-with(normalize-space(), 'Search By:')]"))
    scroll_and_click(wait, button("Appointment Time"))

    picker = wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "input[type='time']"))
    assert picker.is_displayed()


def test_decline_without_a_reason_is_blocked(dashboard, wait):
    require_card(dashboard, "Manage Quotes", "Decline", "pending quotes")

    click_in_panel(wait, "Manage Quotes", "Decline")
    click_in_panel(wait, "Manage Quotes", "Confirm Decline")
    wait_for_text(wait, "A reason is required before you can decline this quote.")

    click_in_panel(wait, "Manage Quotes", "Cancel")  # close the prompt; nothing was saved


def test_accept_then_cancel_keeps_the_quote(dashboard, wait):
    require_card(dashboard, "Manage Quotes", "Accept", "pending quotes")

    click_in_panel(wait, "Manage Quotes", "Accept")
    name = wait.until(lambda d: d.find_element(
        By.XPATH, "//h3[normalize-space()='Accept Quote?']/following-sibling::p/strong")).text
    scroll_and_click(wait, button("Cancel"))

    wait.until(EC.invisibility_of_element_located((By.XPATH, "//h3[normalize-space()='Accept Quote?']")))
    wait_for_panel_text(dashboard, "Manage Quotes", name)  # still pending


def test_cancel_appointment_without_a_reason_is_blocked(dashboard, wait):
    require_card(dashboard, "Manage Appointments", "Cancel Appointment", "appointments")

    click_in_panel(wait, "Manage Appointments", "Cancel Appointment")
    click_in_panel(wait, "Manage Appointments", "Confirm Cancellation")
    wait_for_text(wait, "A reason is required before you can cancel this appointment.")

    click_in_panel(wait, "Manage Appointments", "Keep Appointment")


def test_update_with_no_changes_is_blocked(dashboard, wait):
    require_card(dashboard, "Manage Appointments", "Edit", "appointments")

    click_in_panel(wait, "Manage Appointments", "Edit")
    click_in_panel(wait, "Manage Appointments", "Update Appointment")
    wait_for_text(wait, "No changes to save. Edit a field first.")

    click_in_panel(wait, "Manage Appointments", "Cancel")  # leave edit mode; nothing was saved


# ---------- Changes data: opt-in only ----------

@allows_data_changes
def test_quote_lifecycle_accept_cancel_and_restore(dashboard, wait):
    """Accept the test quote, cancel the appointment, then move it back to Manage Quotes.
    Ends with the test quote pending again, so it can be re-run."""
    reason = "SCRUM-230 Selenium lifecycle test"
    no_match = f"No appointments found matching '{TEST_QUOTE_NAME}'."
    open_search(wait, TEST_QUOTE_NAME)  # only the test quote is visible from here on

    # 1. The test quote is pending, and it's the only match
    require_card(dashboard, "Manage Quotes", "Accept", f"pending quote named '{TEST_QUOTE_NAME}'")
    assert "Page 1/" not in panel_text(dashboard, "Manage Quotes"), \
        "More than one pending quote matches TEST_QUOTE_NAME; use a unique name"

    # 2. Accept: the quote moves to Manage Appointments
    click_in_panel(wait, "Manage Quotes", "Accept")
    scroll_and_click(wait, button("Yes, Accept"))
    wait_for_panel_text(dashboard, "Manage Quotes", no_match)
    wait_for_panel_text(dashboard, "Manage Appointments", TEST_QUOTE_NAME)

    # 3. Cancel with a reason: it moves to Declined Quotes (the email step can take a while)
    click_in_panel(wait, "Manage Appointments", "Cancel Appointment")
    panel(dashboard, "Manage Appointments").find_element(By.TAG_NAME, "textarea").send_keys(reason)
    click_in_panel(wait, "Manage Appointments", "Confirm Cancellation")
    accept_alert_if_shown(dashboard)
    wait_for_panel_text(dashboard, "Manage Appointments", no_match, timeout=30)
    wait_for_panel_text(dashboard, "Declined Quotes", reason, timeout=30)

    # 4. Move it back: the quote is pending again
    click_in_panel(wait, "Declined Quotes", "Move to Manage Quotes")
    scroll_and_click(wait, button("Yes, Move to Manage Quotes"))
    wait_for_panel_text(dashboard, "Manage Quotes", TEST_QUOTE_NAME)
    wait_for_panel_text(dashboard, "Declined Quotes", no_match)
"""Functional (black-box) tests for the About Us page (SCRUM-232).

Drives a real Chrome browser against the running site to verify content rendering and layout.
"""

import pytest
from conftest import wait_for_path, wait_for_text


def test_about_page_loads_and_displays_main_heading(driver, open_page, wait):
    """Verifies that navigating to /about displays the primary heading and company info."""
    open_page("/about")
    wait_for_path(wait, "/about")

    # Verify main title text is visible
    wait_for_text(wait, "About Us")


def test_about_page_displays_owner_and_locations(driver, open_page, wait):
    """Verifies owner details and service regions render properly in the browser."""
    open_page("/about")
    wait_for_path(wait, "/about")

    wait_for_text(wait, "Nigel Prasad")
    wait_for_text(wait, "Northern California")


def test_about_page_displays_offerings_and_services(driver, open_page, wait):
    """Verifies the 'What We Offer' section and specific cleaning services appear."""
    open_page("/about")
    wait_for_path(wait, "/about")

    wait_for_text(wait, "What We Offer")
    wait_for_text(wait, "Commercial Cleaning")
    wait_for_text(wait, "Carpet Cleaning")
    wait_for_text(wait, "Stripping and Wax Services")


def test_about_page_displays_core_values(driver, open_page, wait):
    """Verifies the client value pillars (Reliable, Detail-Oriented, Professional) are visible."""
    open_page("/about")
    wait_for_path(wait, "/about")

    wait_for_text(wait, "Why Clients Choose Us")
    wait_for_text(wait, "Reliable")
    wait_for_text(wait, "Detail-Oriented")
    wait_for_text(wait, "Professional")

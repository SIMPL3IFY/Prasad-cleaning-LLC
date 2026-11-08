"""Functional (black-box) tests for the About Us page (SCRUM-232).

Drives a real Chrome browser against the running site to verify scoped section content.
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from conftest import wait_for_path, wait_for_text


def test_about_page_loads_and_displays_main_heading(driver, open_page, wait):
    """Verifies that navigating to /about displays the scoped h1 banner heading."""
    open_page("/about")
    wait_for_path(wait, "/about")

    # Scope title check specifically to h1 inside banner
    h1 = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".banner h1.page-title")))
    assert h1.text.strip() == "About Us"

    eyebrow = driver.find_element(By.CSS_SELECTOR, ".banner .banner-eyebrow")
    assert "Locally owned & operated" in eyebrow.text


def test_about_page_displays_owner_and_locations(driver, open_page, wait):
    """Verifies owner details and regions render inside the Who We Are section."""
    open_page("/about")
    wait_for_path(wait, "/about")

    # Scope lookups specifically inside the main about container to ignore header/footer duplicates
    about_card = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".about-card")))
    card_text = about_card.text

    assert "Who We Are" in card_text
    assert "Nigel Prasad" in card_text
    assert "Northern California" in card_text


def test_about_page_displays_offerings_and_services(driver, open_page, wait):
    """Verifies the 'What We Offer' section and list of cleaning services appear dynamically."""
    open_page("/about")
    wait_for_path(wait, "/about")

    offer_card = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".about-offer-card")))
    assert "What We Offer" in offer_card.text

    # Dynamically verify list items exist inside the service list container
    service_items = offer_card.find_elements(By.CSS_SELECTOR, "ul.about-service-list-clean li")
    assert len(service_items) > 0

    # Check key core service keywords inside the list items
    item_texts = [item.text for item in service_items]
    assert any("Commercial Cleaning" in text for text in item_texts)
    assert any("Carpet Cleaning" in text for text in item_texts)


def test_about_page_displays_core_values(driver, open_page, wait):
    """Verifies the client value pillars render inside their respective h3 headings."""
    open_page("/about")
    wait_for_path(wait, "/about")

    wait_for_text(wait, "Why Clients Choose Us")

    # Check value titles inside h3 elements specifically within .about-value-card
    h3_elements = driver.find_elements(By.CSS_SELECTOR, ".about-value-card h3")
    h3_titles = [h.text.strip() for h in h3_elements]

    assert "Reliable" in h3_titles
    assert "Detail-Oriented" in h3_titles
    assert "Professional" in h3_titles

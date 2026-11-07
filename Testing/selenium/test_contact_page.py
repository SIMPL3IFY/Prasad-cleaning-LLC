"""Functional (black-box) tests for the Request a Quote / Contact page (SCRUM-245).

Drives a real Chrome browser against the running site, the way a customer would use it.
A real submit would save a quote to the live database and call the real address check,
so every test here stops before that: each form check fills in at least one bad value,
and our own validation blocks it before anything is sent. A successful submit is covered
by the unit tests, which fake Supabase.
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

from conftest import scroll_and_click, wait_for_path, wait_for_text

SUBMIT = (By.XPATH, '//button[normalize-space()="Get My Free Quote"]')
SERVICES = ["Standard Cleaning", "Deep Cleaning", "Move-in / Move-Out", "Custom Requests"]

VALID = {
    "Name": "Selenium Test",
    "Email": "selenium@example.com",
    "Phone": "9161234567",
    "Street address": "123 Main St",
    "City": "Sacramento",
    "ZIP": "95814",
    "How can we help?": "Selenium test, please ignore.",
}


def field(driver, placeholder):
    return driver.find_element(By.CSS_SELECTOR, f'[placeholder="{placeholder}"]')


def dropdown(driver, name):
    return Select(driver.find_element(By.CSS_SELECTOR, f'select[name="{name}"]'))


def fill_form(driver, overrides=None):
    """Fill every field. Pass {placeholder: value} to change a value, or "" to leave a field empty."""
    values = {**VALID, **(overrides or {})}
    for placeholder, value in values.items():
        if value:
            field(driver, placeholder).send_keys(value)
    dropdown(driver, "propertyType").select_by_visible_text("Residential")
    dropdown(driver, "serviceType").select_by_visible_text("Deep Cleaning")


def submit(driver):
    button = driver.find_element(*SUBMIT)
    # behavior 'instant' overrides the site's smooth scrolling, so the click doesn't land mid-scroll
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'})", button)
    button.click()


def test_page_shows_the_heading_form_title_and_note(driver, open_page, wait):
    open_page("/contact")

    wait_for_text(wait, "Let's get your space sparkling")
    wait_for_text(wait, "Request your free quote")
    wait_for_text(wait, "All fields are required.")


def test_how_it_works_shows_all_three_steps(driver, open_page, wait):
    open_page("/contact")

    for step in ["Tell us about your space", "We review your request", "Get scheduled"]:
        wait_for_text(wait, step)


def test_what_we_offer_lists_the_services(driver, open_page, wait):
    open_page("/contact")

    chips = wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".contact-chips li"))

    assert [chip.text for chip in chips] == SERVICES


def test_cities_link_goes_to_the_service_area_page(driver, open_page, wait):
    open_page("/contact")
    wait_for_text(wait, "What we offer")

    scroll_and_click(wait, (By.PARTIAL_LINK_TEXT, "See the cities we serve"))

    wait_for_path(wait, "/service-area")


def test_dropdowns_start_on_their_placeholder_and_offer_the_right_options(driver, open_page, wait):
    open_page("/contact")
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, 'select[name="propertyType"]'))

    property_type = dropdown(driver, "propertyType")
    service_type = dropdown(driver, "serviceType")

    assert property_type.first_selected_option.text == "Select property type"
    assert service_type.first_selected_option.text == "Select service type"
    assert [option.text for option in property_type.options[1:]] == ["Residential", "Commercial"]
    assert [option.text for option in service_type.options[1:]] == SERVICES


def test_state_starts_on_ca(driver, open_page, wait):
    open_page("/contact")
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '[placeholder="State"]'))

    assert field(driver, "State").get_attribute("value") == "CA"


def test_button_stays_disabled_until_every_field_is_filled(driver, open_page, wait):
    open_page("/contact")
    wait_for_text(wait, "Request your free quote")
    button = driver.find_element(*SUBMIT)
    assert not button.is_enabled()

    # Leave the message empty: everything else is filled, but the button must stay disabled
    fill_form(driver, {"How can we help?": ""})
    assert not button.is_enabled()

    field(driver, "How can we help?").send_keys(VALID["How can we help?"])
    wait.until(lambda d: d.find_element(*SUBMIT).is_enabled())


def test_email_without_a_domain_ending_shows_an_error(driver, open_page, wait):
    open_page("/contact")
    wait_for_text(wait, "Request your free quote")

    fill_form(driver, {"Email": "name@example"})
    submit(driver)

    wait_for_text(wait, "Please enter a valid email address.")


def test_phone_without_ten_digits_shows_an_error(driver, open_page, wait):
    open_page("/contact")
    wait_for_text(wait, "Request your free quote")

    fill_form(driver, {"Phone": "555123456"})
    submit(driver)

    wait_for_text(wait, "Please enter a valid 10-digit phone number.")


def test_zip_without_five_digits_shows_an_error(driver, open_page, wait):
    open_page("/contact")
    wait_for_text(wait, "Request your free quote")

    fill_form(driver, {"ZIP": "958"})
    submit(driver)

    wait_for_text(wait, "Please enter a 5-digit ZIP code.")


def test_bad_values_keep_what_the_customer_typed(driver, open_page, wait):
    open_page("/contact")
    wait_for_text(wait, "Request your free quote")

    fill_form(driver, {"Email": "name@example"})
    submit(driver)
    wait_for_text(wait, "Please enter a valid email address.")

    assert field(driver, "Name").get_attribute("value") == VALID["Name"]
    assert field(driver, "Email").get_attribute("value") == "name@example"
    assert field(driver, "How can we help?").get_attribute("value") == VALID["How can we help?"]

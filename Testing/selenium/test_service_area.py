"""Functional (black-box) tests for the Service Area page (SCRUM-249).

Drives a real Chrome browser against the running site, the way a customer would use it.
The empty city list can't happen on the real site, so that case is only covered by the unit tests.
"""
import json
from pathlib import Path
from urllib.parse import quote

from selenium.webdriver.common.by import By

from conftest import wait_for_path

CITIES = json.loads((Path(__file__).parents[2] / "src/data/cities.json").read_text())["cities"]
OVERVIEW_MAP = "!2d-121.4944!3d38.5816"
MAP = (By.CSS_SELECTOR, "iframe.area-map-frame")
SELECTION_BAR = (By.CSS_SELECTOR, ".map-selection-bar")
CITY_BUTTONS = (By.CSS_SELECTOR, ".city-panel button.city-button")
RESET = (By.XPATH, "//button[normalize-space()='Show full service area']")


def city_button(name):
    return (By.XPATH, f"//button[contains(@class, 'city-button')][normalize-space()='{name}']")


def scroll_into_view(driver, element):
    # behavior 'instant' overrides the site's smooth scrolling, so the element is in place right away
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'})", element)


def click(driver, locator):
    element = driver.find_element(*locator)
    scroll_into_view(driver, element)
    element.click()


def open_service_area(open_page, wait):
    open_page("/service-area")
    wait.until(lambda d: d.find_elements(*CITY_BUTTONS))


def map_src(driver):
    return driver.find_element(*MAP).get_attribute("src")


def wait_for_full_service_area(driver, wait):
    wait.until(lambda d: OVERVIEW_MAP in map_src(d))
    wait.until(lambda d: d.find_element(*SELECTION_BAR).text == "Showing the full service area")
    assert not driver.find_elements(*RESET)


def wait_for_city(wait, city):
    wait.until(lambda d: f"q={quote(f'{city}, CA')}" in map_src(d))
    wait.until(lambda d: d.find_element(*SELECTION_BAR).text.startswith(f"Showing {city}"))


def top_in_viewport(driver, element):
    # Only the top edge, since the map can be taller than a phone screen
    return driver.execute_script(
        "const r = arguments[0].getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight",
        element,
    )


def test_every_city_is_a_button_under_cities_we_serve(driver, open_page, wait):
    open_service_area(open_page, wait)

    assert driver.find_element(By.CSS_SELECTOR, ".city-panel h2").text == "Cities We Serve"
    assert [button.text for button in driver.find_elements(*CITY_BUTTONS)] == CITIES


def test_map_shows_full_service_area_and_loads(driver, open_page, wait):
    open_service_area(open_page, wait)

    wait_for_full_service_area(driver, wait)

    # The map is a Google Maps iframe; check that Google actually drew something inside it
    frame = driver.find_element(*MAP)
    scroll_into_view(driver, frame)
    driver.switch_to.frame(frame)
    wait.until(lambda d: d.execute_script("return document.body && document.body.children.length > 0"))
    driver.switch_to.default_content()


def test_picking_a_city_focuses_the_map_on_it(driver, open_page, wait):
    open_service_area(open_page, wait)

    click(driver, city_button("Davis"))

    wait_for_city(wait, "Davis")
    assert driver.find_element(*city_button("Davis")).get_attribute("aria-pressed") == "true"


def test_clicking_the_same_city_again_returns_to_full_service_area(driver, open_page, wait):
    open_service_area(open_page, wait)
    click(driver, city_button("Davis"))
    wait_for_city(wait, "Davis")

    click(driver, city_button("Davis"))

    wait_for_full_service_area(driver, wait)


def test_show_full_service_area_button_returns_to_full_service_area(driver, open_page, wait):
    open_service_area(open_page, wait)
    click(driver, city_button("Davis"))
    wait_for_city(wait, "Davis")

    click(driver, RESET)

    wait_for_full_service_area(driver, wait)
    assert driver.find_element(*city_button("Davis")).get_attribute("aria-pressed") == "false"


def test_only_one_city_is_selected_at_a_time(driver, open_page, wait):
    open_service_area(open_page, wait)

    click(driver, city_button("Davis"))
    click(driver, city_button("Folsom"))

    wait_for_city(wait, "Folsom")
    selected = [b.text for b in driver.find_elements(*CITY_BUTTONS) if b.get_attribute("aria-pressed") == "true"]
    assert selected == ["Folsom"]


def test_map_scrolls_into_view_on_a_phone(driver, open_page, wait):
    # On narrow screens the map stacks above the city list, so picking a city far down must bring the map back
    driver.set_window_size(390, 844)
    open_service_area(open_page, wait)
    last_city = CITIES[-1]

    click(driver, city_button(last_city))

    wait_for_city(wait, last_city)
    wait.until(lambda d: top_in_viewport(d, d.find_element(By.CSS_SELECTOR, ".area-map")))


def test_get_a_free_quote_goes_to_contact(driver, open_page, wait):
    open_service_area(open_page, wait)

    click(driver, (By.LINK_TEXT, "Get a Free Quote"))

    wait_for_path(wait, "/contact")


def test_sign_in_goes_to_sign_in(driver, open_page, wait):
    open_service_area(open_page, wait)

    click(driver, (By.CSS_SELECTOR, ".page-cta a[href='/signin']"))

    wait_for_path(wait, "/signin")

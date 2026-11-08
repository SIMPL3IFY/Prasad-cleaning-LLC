"""Functional (black-box) tests for the Services page (SCRUM-247).

Drives a real Chrome browser against the running site, the way a customer would use it.
These read the real services table, so they don't assume which services exist.
"""
from selenium.webdriver.common.by import By

from conftest import wait_for_path, wait_for_text

CARDS = (By.CSS_SELECTOR, "button.service-card")
LOADING_MESSAGE = "Loading services..."
BUILT_IN_SERVICES = [
    "Residential Cleaning",
    "Commercial Cleaning",
    "Move-in / Move-Out",
    "Deep Cleaning",
    "Recurring Maintenance",
    "Custom Requests",
    "Special Offers",
]


def card(name):
    return (By.CSS_SELECTOR, f'button[aria-label="Toggle details for {name}"]')


def card_name(element):
    return element.get_attribute("aria-label").removeprefix("Toggle details for ")


def scroll_into_view(driver, element):
    # behavior 'instant' overrides the site's smooth scrolling, so the element is in place right away
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'})", element)


def load_cards(open_page, wait, path="/services"):
    open_page(path)
    return wait.until(lambda d: d.find_elements(*CARDS))


def face_on_top(driver, element):
    """Which face of the card ("front" or "back") the browser shows at the card's center."""
    return driver.execute_script(
        """
        const card = arguments[0]
        const box = card.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        const face = hit && hit.closest('.service-card-face')
        if (!face || !card.contains(face)) return null
        return face.classList.contains('service-card-back') ? 'back' : 'front'
        """,
        element,
    )


def block_supabase(driver):
    """Make every Supabase request fail, like when the database can't be reached."""
    driver.execute_cdp_cmd("Network.enable", {})
    driver.execute_cdp_cmd("Network.setBlockedURLs", {"urls": ["*.supabase.co*"]})


def test_loading_message_goes_away_once_services_load(driver, open_page, wait):
    load_cards(open_page, wait)

    wait.until(lambda d: LOADING_MESSAGE not in d.find_element(By.TAG_NAME, "body").text)


def test_shows_all_services_not_only_featured(driver, open_page, wait):
    # The landing page shows only featured services, so the Services page should show at least as many
    featured_count = len(load_cards(open_page, wait, "/"))
    all_count = len(load_cards(open_page, wait))

    assert all_count >= featured_count


def test_each_card_shows_its_name_and_a_loaded_image(driver, open_page, wait):
    for element in load_cards(open_page, wait):
        name = card_name(element)
        assert element.find_element(By.CSS_SELECTOR, ".service-card-front .service-card-title").text == name

        image = element.find_element(By.CSS_SELECTOR, "img.service-card-img")
        assert image.get_attribute("alt") == name
        scroll_into_view(driver, image)
        # naturalWidth stays 0 if the image failed to load
        wait.until(lambda d: d.execute_script("return arguments[0].complete && arguments[0].naturalWidth > 0", image))


def test_card_flips_to_the_description_and_back(driver, open_page, wait):
    first = load_cards(open_page, wait)[0]
    scroll_into_view(driver, first)
    assert face_on_top(driver, first) == "front"

    first.click()
    wait.until(lambda d: face_on_top(d, first) == "back")
    assert first.get_attribute("aria-pressed") == "true"

    first.click()
    wait.until(lambda d: face_on_top(d, first) == "front")
    assert first.get_attribute("aria-pressed") == "false"


def test_every_card_has_a_description_on_the_back(driver, open_page, wait):
    for element in load_cards(open_page, wait):
        # textContent, because .text is empty for the hidden back face
        description = element.find_element(By.CSS_SELECTOR, ".service-card-back p").get_attribute("textContent")
        assert description.strip(), f"{card_name(element)} has no description"


def test_built_in_services_show_if_loading_fails(driver, open_page, wait):
    block_supabase(driver)

    names = [card_name(element) for element in load_cards(open_page, wait)]

    assert names == BUILT_IN_SERVICES


def test_request_a_quote_goes_to_contact(driver, open_page, wait):
    load_cards(open_page, wait)
    link = driver.find_element(By.LINK_TEXT, "Request a quote")
    # The site scrolls smoothly, so jump straight there or the click lands mid-scroll on the wrong element
    scroll_into_view(driver, link)

    link.click()

    wait_for_path(wait, "/contact")


def test_loading_message_shows_while_services_load(driver, open_page, wait):
    # Hold Supabase requests back 3 seconds so the loading message stays on screen long enough to see
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
        const realFetch = window.fetch
        window.fetch = (input, init) => {
            const url = typeof input === 'string' ? input : input.url
            if (!url.includes('.supabase.co')) return realFetch(input, init)
            return new Promise((resolve) => setTimeout(resolve, 3000)).then(() => realFetch(input, init))
        }
    """})
    open_page("/services")

    wait_for_text(wait, LOADING_MESSAGE)

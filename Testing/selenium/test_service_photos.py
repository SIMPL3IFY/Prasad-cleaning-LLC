"""SCRUM-253: Real-browser checks for the admin Edit Services popup.

Default tests change nothing: they never press a button that saves. The one test that
writes is opt-in because it adds a real service, which is briefly visible on the live
site. It deletes the service itself; if it stops early, delete any "Selenium Test 253"
rows from the services table and their photos from the service-images bucket.
"""
import base64
import os
import uuid

import pytest
from selenium.webdriver.common.by import By

from conftest import button, scroll_and_click, wait_for_path, wait_for_text

ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD")

pytestmark = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD),
    reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to a real admin account",
)

needs_service_writes = pytest.mark.skipif(
    os.environ.get("RUN_SERVICE_WRITE_TESTS") != "1",
    reason="Set RUN_SERVICE_WRITE_TESTS=1 to add and delete a real service",
)

WRONG_TYPE_MESSAGE = "Please choose a JPG, PNG, or WebP image."
TOO_LARGE_MESSAGE = "Please choose an image smaller than 5 MB."
MAX_FILE_SIZE = 5 * 1024 * 1024
# A valid 1x1 PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@pytest.fixture
def popup(driver, open_page, wait):
    """Signs in as the admin and opens the Edit Services popup."""
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(ADMIN_EMAIL)
    driver.find_element(By.ID, "password").send_keys(ADMIN_PASSWORD)
    driver.find_element(*button("Sign In")).click()
    wait_for_path(wait, "/admin")
    open_popup(driver, wait)


@pytest.fixture
def png_file(tmp_path):
    path = tmp_path / "new-photo.png"
    path.write_bytes(PNG_BYTES)
    return str(path)


@pytest.fixture
def pdf_file(tmp_path):
    path = tmp_path / "notes.pdf"
    path.write_bytes(b"%PDF-1.4 not a photo")
    return str(path)


@pytest.fixture
def oversized_file(tmp_path):
    path = tmp_path / "huge.png"
    path.write_bytes(PNG_BYTES + b"0" * MAX_FILE_SIZE)
    return str(path)


def open_popup(driver, wait):
    scroll_and_click(wait, button("Manage Services"))
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".admin-modal .admin-review-list > li"))


def service_names(driver):
    return [e.text for e in driver.find_elements(By.CSS_SELECTOR, ".admin-modal .admin-review-list > li strong")]


def first_service(driver):
    return service_names(driver)[0]


def card(driver, name):
    return driver.find_element(By.XPATH, f"//div[contains(@class,'admin-modal')]//li[.//strong[normalize-space()=\"{name}\"]]")


def click(driver, element):
    """Jump straight to the element: the popup scrolls, and the site scrolls smoothly."""
    driver.execute_script("arguments[0].scrollIntoView({block: 'center', behavior: 'instant'})", element)
    element.click()


def pick_photo(driver, name, path):
    card(driver, name).find_element(By.CSS_SELECTOR, "input[type='file']").send_keys(path)


def add_form_button(driver):
    return driver.find_element(By.CSS_SELECTOR, ".admin-add-service button[type='submit']")


def alert_text(driver):
    return driver.find_element(By.CSS_SELECTOR, ".admin-modal [role='alert']").text


def test_popup_lists_services_and_closes(driver, popup, wait):
    names = service_names(driver)
    assert names
    assert card(driver, names[0]).find_element(By.CSS_SELECTOR, "img.admin-photo-thumb").get_attribute("src").startswith("http")

    click(driver, driver.find_element(By.CSS_SELECTOR, "[aria-label='Close edit services']"))

    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".admin-modal"))


def test_every_service_shows_its_visibility_and_a_matching_button(driver, popup):
    for name in service_names(driver):
        service = card(driver, name)
        badge = service.find_element(By.CSS_SELECTOR, ".admin-badge").text
        assert badge in ("Visible", "Hidden")
        expected = "Hide" if badge == "Visible" else "Show"
        assert service.find_element(By.XPATH, f".//button[normalize-space()=\"{expected}\"]").is_displayed()


def test_wrong_file_type_is_rejected_and_can_be_picked_again(driver, popup, wait, pdf_file, png_file):
    name = first_service(driver)
    pick_photo(driver, name, pdf_file)
    wait_for_text(wait, WRONG_TYPE_MESSAGE)
    assert card(driver, name).find_element(By.CSS_SELECTOR, "input[type='file']").get_attribute("value") == ""
    assert not card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Save photo\"]").is_enabled()

    # A good file clears the error, so a second rejection has to show it again
    pick_photo(driver, name, png_file)
    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".admin-modal [role='alert']"))
    pick_photo(driver, name, pdf_file)
    wait_for_text(wait, WRONG_TYPE_MESSAGE)


def test_file_over_5_mb_is_rejected(driver, popup, wait, oversized_file):
    name = first_service(driver)
    pick_photo(driver, name, oversized_file)

    wait_for_text(wait, TOO_LARGE_MESSAGE)
    assert not card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Save photo\"]").is_enabled()


def test_good_photo_previews_without_saving(driver, popup, wait, png_file):
    name = first_service(driver)
    original = card(driver, name).find_element(By.CSS_SELECTOR, "img.admin-photo-thumb").get_attribute("src")
    pick_photo(driver, name, png_file)

    wait.until(lambda d: card(d, name).find_element(By.CSS_SELECTOR, "img.admin-photo-thumb").get_attribute("src").startswith("blob:"))
    assert card(driver, name).find_element(By.CSS_SELECTOR, ".admin-file-name").text == "new-photo.png"
    assert card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Save photo\"]").is_enabled()

    # Closing without saving throws the photo away
    click(driver, driver.find_element(By.CSS_SELECTOR, "[aria-label='Close edit services']"))
    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".admin-modal"))
    open_popup(driver, wait)
    assert card(driver, name).find_element(By.CSS_SELECTOR, "img.admin-photo-thumb").get_attribute("src") == original


def test_description_edit_is_not_saved_until_asked(driver, popup, wait):
    name = first_service(driver)
    field = card(driver, name).find_element(By.CSS_SELECTOR, "textarea")
    original = field.get_attribute("value")
    save = card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Save description\"]")
    assert not save.is_enabled()
    assert field.get_attribute("maxlength") == "300"

    field.send_keys("x")
    assert save.is_enabled()

    click(driver, driver.find_element(By.CSS_SELECTOR, "[aria-label='Close edit services']"))
    wait.until(lambda d: not d.find_elements(By.CSS_SELECTOR, ".admin-modal"))
    open_popup(driver, wait)
    assert card(driver, name).find_element(By.CSS_SELECTOR, "textarea").get_attribute("value") == original


def test_delete_asks_first_and_cancel_keeps_the_service(driver, popup, wait):
    names = service_names(driver)
    name = names[0]
    click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Delete\"]"))
    wait_for_text(wait, f"Delete {name}?")

    click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Cancel\"]"))

    assert card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Delete\"]").is_displayed()
    assert service_names(driver) == names


def test_add_service_requires_a_name(driver, popup, wait):
    click(driver, add_form_button(driver))
    wait_for_text(wait, "Please enter a service name.")


def test_add_service_rejects_a_duplicate_name(driver, popup, wait, png_file):
    name = first_service(driver)
    driver.find_element(By.ID, "new-service-name").send_keys(name.upper())
    driver.find_element(By.ID, "new-service-photo").send_keys(png_file)
    click(driver, add_form_button(driver))

    # The message contains quote marks, which wait_for_text can't search for
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".admin-modal [role='alert']"))
    assert alert_text(driver) == f'A service named "{name.upper()}" already exists.'


def test_add_service_requires_a_photo(driver, popup, wait):
    driver.find_element(By.ID, "new-service-name").send_keys(f"Selenium Test 253 {uuid.uuid4().hex[:8]}")
    click(driver, add_form_button(driver))

    wait_for_text(wait, "Please choose a photo for the new service.")


def test_add_service_rejects_a_bad_photo_and_clears_it(driver, popup, wait, pdf_file):
    driver.find_element(By.ID, "new-service-photo").send_keys(pdf_file)

    wait_for_text(wait, WRONG_TYPE_MESSAGE)
    assert driver.find_element(By.ID, "new-service-photo").get_attribute("value") == ""


@needs_service_writes
def test_add_edit_hide_replace_and_delete_a_real_service(driver, popup, wait, png_file, tmp_path):
    name = f"Selenium Test 253 {uuid.uuid4().hex[:8]}"
    second_photo = tmp_path / "second-photo.png"
    second_photo.write_bytes(PNG_BYTES)
    created = False

    try:
        driver.find_element(By.ID, "new-service-name").send_keys(name)
        driver.find_element(By.ID, "new-service-description").send_keys("Automated test, please delete")
        driver.find_element(By.ID, "new-service-photo").send_keys(png_file)
        click(driver, add_form_button(driver))
        wait_for_text(wait, f"{name} was added.")
        created = True

        # The next invalid attempt replaces the success message
        click(driver, add_form_button(driver))
        wait_for_text(wait, "Please enter a service name.")
        assert not driver.find_elements(By.CSS_SELECTOR, ".admin-modal .admin-note--success")

        field = card(driver, name).find_element(By.CSS_SELECTOR, "textarea")
        field.send_keys(" edited")
        click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Save description\"]"))
        wait_for_text(wait, f"{name} description updated.")

        click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Hide\"]"))
        wait_for_text(wait, f"{name} is now hidden from the site.")
        assert card(driver, name).find_element(By.CSS_SELECTOR, ".admin-badge").text == "Hidden"

        pick_photo(driver, name, str(second_photo))
        click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Save photo\"]"))
        wait_for_text(wait, f"{name} photo updated.")
    finally:
        if created:
            click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Delete\"]"))
            click(driver, card(driver, name).find_element(By.XPATH, ".//button[normalize-space()=\"Yes, delete\"]"))
            wait_for_text(wait, f"{name} was deleted.")

    assert name not in service_names(driver)

"""Security tests that need a real browser.

The raw-HTTP attack suite lives in Testing/securityTest/. These are the checks only a
browser can make: does a stored script actually run, can browser storage be edited to
get past the route guards, does the back button leak a signed-out session, and can the
site be framed by another page.
"""
import json
import os
import urllib.error
import urllib.request
import uuid
from pathlib import Path

import pytest
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.by import By

from conftest import BASE_URL, button, scroll_and_click, wait_for_path, wait_for_text

ROOT = Path(__file__).resolve().parents[2]


def _dotenv():
    env_file = ROOT / ".env"
    if not env_file.exists():
        return {}
    pairs = (line.split("=", 1) for line in env_file.read_text(encoding="utf-8").splitlines()
             if "=" in line and not line.lstrip().startswith("#"))
    return {key.strip(): value.strip().strip('"').strip("'") for key, value in pairs}


_ENV = _dotenv()


def setting(name, default=""):
    """Shell variable first, then the project's .env."""
    return os.environ.get(name) or _ENV.get(name) or default


ADMIN_EMAIL, ADMIN_PASSWORD = setting("TEST_ADMIN_EMAIL"), setting("TEST_ADMIN_PASSWORD")
CUSTOMER_EMAIL, CUSTOMER_PASSWORD = setting("TEST_CUSTOMER_EMAIL"), setting("TEST_CUSTOMER_PASSWORD")
SUPABASE_URL = setting("VITE_SUPABASE_URL").rstrip("/")
PUBLIC_KEY = setting("VITE_SUPABASE_PUBLISHABLE_KEY")
SITE_URL = setting("SITE_URL", "https://prasadscleaning.com").rstrip("/")

needs_admin_account = pytest.mark.skipif(
    not (ADMIN_EMAIL and ADMIN_PASSWORD), reason="Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to a real admin account",
)
needs_customer_account = pytest.mark.skipif(
    not (CUSTOMER_EMAIL and CUSTOMER_PASSWORD),
    reason="Set TEST_CUSTOMER_EMAIL and TEST_CUSTOMER_PASSWORD to a real customer account",
)

SIGNED_OUT_MESSAGE = "Please sign in with an administrator account."
FORBIDDEN_MESSAGE = "Access denied. This account is not an administrator."
DEMO_FLAG = "prasad-admin-demo-access"

# Each payload sets window.__xss if the browser ever runs it.
XSS_FIELDS = {
    "address": "<img src=x onerror=window.__xss=1>",
    "message": "<script>window.__xss=1</script>",
    "service": "\"><svg onload=window.__xss=1>",
    "property": "<iframe srcdoc=\"<script>parent.__xss=1</script>\"></iframe>",
}
INJECTED_ELEMENTS = "img[src='x'], svg[onload], iframe[srcdoc], b[onmouseover]"


# ---------- helpers ----------

def api(method, path, body=None, token=None):
    """Small Supabase call used only to set up and remove this file's test quote."""
    request = urllib.request.Request(
        f"{SUPABASE_URL}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"apikey": PUBLIC_KEY, "Content-Type": "application/json",
                 "Authorization": f"Bearer {token or PUBLIC_KEY}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            text = response.read().decode()
            return response.status, json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def sign_in(driver, open_page, wait, email, password):
    open_page("/signin")
    wait.until(lambda d: d.find_element(By.ID, "email")).send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(*button("Sign In")).click()


def xss_ran(driver):
    try:
        driver.switch_to.alert.dismiss()
        return True
    except NoAlertPresentException:
        pass
    return bool(driver.execute_script("return window.__xss"))


def dashboard_is_showing(driver):
    return bool(driver.find_elements(By.XPATH, "//h2[normalize-space()='Manage Quotes']"))


def auth_token_keys(driver):
    return driver.execute_script(
        "return Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))"
    )


# ---------- stored XSS ----------

@pytest.fixture
def xss_quote():
    """A pending quote full of script payloads, saved the way the public quote form saves it."""
    if not (SUPABASE_URL and PUBLIC_KEY):
        pytest.skip("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be in .env")
    name = f"SELTEST-{uuid.uuid4().hex[:8]}"
    status, body = api("POST", "/rest/v1/quotes", {
        "customer_name": f"{name} <b onmouseover=window.__xss=1>XSS</b>",
        "email": "prasad.testers2026@gmail.com", "phone": "9165550100", "status": "pending", **XSS_FIELDS,
    })
    assert status == 201, f"Could not save the test quote: {status} {body}"
    yield name

    # Remove it again as the admin
    _, session = api("POST", "/auth/v1/token?grant_type=password", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    token = session["access_token"]
    _, rows = api("GET", f"/rest/v1/quotes?select=id&customer_name=like.{name}*", token=token)
    for row in rows or []:
        status, _ = api("POST", "/rest/v1/rpc/scrum242_delete_quote", {"p_table": "quotes", "p_quote_id": row["id"]}, token)
        if status >= 300:
            print(f"\n[security] Delete the '{name}' row from quotes by hand")


@needs_admin_account
def test_script_in_a_quote_does_not_run_on_the_admin_dashboard(driver, open_page, wait, xss_quote):
    sign_in(driver, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)
    wait_for_path(wait, "/admin")
    wait.until(dashboard_is_showing)

    # Find the test quote (the box shows one quote per page)
    scroll_and_click(wait, button("Search Quotes By"))
    wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "input[placeholder^='Search by']")).send_keys(xss_quote)
    wait_for_text(wait, XSS_FIELDS["message"])  # the payload is on screen, as plain text

    page_text = driver.find_element(By.TAG_NAME, "body").text
    for field, payload in XSS_FIELDS.items():
        assert payload in page_text, f"The {field} payload is not shown as plain text"
    assert driver.find_elements(By.CSS_SELECTOR, INJECTED_ELEMENTS) == [], "A payload became a real HTML element"
    assert not xss_ran(driver), "A script stored in a quote RAN in the admin's browser"


@pytest.mark.parametrize("path", [
    "/%3Cimg%20src=x%20onerror=window.__xss=1%3E",
    "/signin?message=%3Cscript%3Ewindow.__xss=1%3C/script%3E&from=%3Cimg%20src=x%20onerror=window.__xss=1%3E",
    "/contact#%3Cimg%20src=x%20onerror=window.__xss=1%3E",
    "/review/%3Cimg%20src=x%20onerror=window.__xss=1%3E",
    "/reset-password?error=%3Csvg%20onload=window.__xss=1%3E",
])
def test_script_in_the_url_does_not_run(driver, open_page, wait, path):
    open_page(path)
    wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "#root > *"))

    assert driver.find_elements(By.CSS_SELECTOR, INJECTED_ELEMENTS) == []
    assert not xss_ran(driver), f"A script in the URL ran on {path}"


# ---------- getting past the route guards by editing browser storage ----------

def test_demo_flag_does_not_open_the_dashboard_to_visitors(driver, open_page, wait):
    """The dashboard has a leftover demo switch in localStorage. Anyone can set it from the console."""
    open_page("/")
    driver.execute_script(f"localStorage.setItem('{DEMO_FLAG}', 'true')")

    open_page("/admin")
    wait_for_path(wait, "/signin")
    wait_for_text(wait, SIGNED_OUT_MESSAGE)
    assert not dashboard_is_showing(driver)


@needs_customer_account
def test_customer_cannot_fake_admin_by_editing_their_session(driver, open_page, wait):
    sign_in(driver, open_page, wait, CUSTOMER_EMAIL, CUSTOMER_PASSWORD)
    wait_for_path(wait, "/portal")

    # Rewrite the saved session to claim admin, and set the demo flag too
    edited = driver.execute_script("""
        const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        const session = JSON.parse(localStorage.getItem(key))
        session.user.role = 'service_role'
        session.user.app_metadata = { ...session.user.app_metadata, role: 'admin', is_admin: true }
        session.user.user_metadata = { ...session.user.user_metadata, is_admin: true }
        localStorage.setItem(key, JSON.stringify(session))
        localStorage.setItem(arguments[0], 'true')
        return key
    """, DEMO_FLAG)
    assert edited, "No saved Supabase session found to edit"

    open_page("/admin")
    wait_for_path(wait, "/signin")
    wait_for_text(wait, FORBIDDEN_MESSAGE)
    assert not dashboard_is_showing(driver)


# ---------- session handling ----------

@needs_admin_account
def test_back_button_after_sign_out_does_not_show_the_dashboard(driver, open_page, wait):
    sign_in(driver, open_page, wait, ADMIN_EMAIL, ADMIN_PASSWORD)
    wait_for_path(wait, "/admin")
    wait.until(dashboard_is_showing)

    scroll_and_click(wait, button("Sign Out"))
    wait.until(lambda d: d.current_url.split("#")[0].rstrip("/") == BASE_URL)
    assert auth_token_keys(driver) == [], "The session is still saved in the browser after Sign Out"

    # Sign-in and sign-out replace their history entries, so Back normally leaves the site.
    # If it ever lands on /admin again, the guard must send it to the sign-in page.
    driver.back()
    wait.until(lambda d: not d.current_url.startswith(BASE_URL) or not d.current_url.rstrip("/").endswith("/admin"))
    assert not dashboard_is_showing(driver), "Back button shows the admin dashboard after Sign Out"


# ---------- clickjacking (deployed site: the local dev server doesn't send the headers) ----------

def test_site_cannot_be_framed_by_another_page(driver, wait):
    driver.get(SITE_URL)
    try:
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, "#root > *"))
    except Exception:
        pytest.skip(f"SITE_URL {SITE_URL} did not load")

    # A page on another origin that tries to show our site in a frame
    driver.get(f"data:text/html,<iframe id='victim' src='{SITE_URL}/signin' width='900' height='600'></iframe>")
    frame = wait.until(lambda d: d.find_element(By.ID, "victim"))
    wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
    driver.switch_to.frame(frame)
    try:
        assert driver.find_elements(By.ID, "email") == [], "The sign-in page loads inside another site's frame"
        assert driver.find_elements(By.ID, "root") == [], "The site loads inside another site's frame"
    finally:
        driver.switch_to.default_content()

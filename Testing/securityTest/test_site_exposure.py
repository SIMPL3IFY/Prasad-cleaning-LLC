"""9. Site exposure: headers, HTTPS, exposed files and secrets in the deployed bundle (SITE_URL)."""
import re
from urllib.parse import urljoin, urlparse

import pytest
import requests

from helpers import JWT_RE, SITE_URL, TIMEOUT, decode_jwt_payload


@pytest.fixture(scope="module")
def home():
    try:
        resp = requests.get(SITE_URL + "/", timeout=TIMEOUT)
    except requests.RequestException as err:
        pytest.skip(f"SITE_URL {SITE_URL} is unreachable: {err}")
    return resp


REQUIRED_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": None,
    "Permissions-Policy": None,
    "Strict-Transport-Security": None,
}


@pytest.mark.parametrize("header", REQUIRED_HEADERS)
def test_security_headers_present(home, header):
    value = home.headers.get(header)
    assert value, f"Missing {header} on {SITE_URL}"
    if REQUIRED_HEADERS[header]:
        assert value.lower() == REQUIRED_HEADERS[header].lower()


def test_content_security_policy_present(home):
    csp = home.headers.get("Content-Security-Policy") or home.headers.get("Content-Security-Policy-Report-Only")
    assert csp, "No Content-Security-Policy header"
    assert "frame-ancestors 'none'" in csp and "object-src 'none'" in csp


def test_security_headers_on_deep_links():
    resp = requests.get(SITE_URL + "/admin", timeout=TIMEOUT)
    assert resp.headers.get("X-Frame-Options") == "DENY", "Headers missing on client-side routes"


def test_http_redirects_to_https(home):
    host = urlparse(SITE_URL).netloc
    resp = requests.get(f"http://{host}/", allow_redirects=False, timeout=TIMEOUT)
    assert resp.status_code in (301, 302, 307, 308), f"HTTP served directly ({resp.status_code})"
    assert resp.headers.get("Location", "").startswith("https://")


SENSITIVE_PATHS = {
    "/.env": re.compile(r"^[A-Z_]{3,}=\S+", re.M),
    "/.env.local": re.compile(r"^[A-Z_]{3,}=\S+", re.M),
    "/.git/config": re.compile(r"\[core\]|repositoryformatversion"),
    "/.git/HEAD": re.compile(r"^ref: refs/", re.M),
    "/supabase/config.toml": re.compile(r"\[api\]|project_id"),
    "/package.json": re.compile(r'"devDependencies"'),
    "/vite.config.js": re.compile(r"defineConfig"),
    "/src/lib/supabaseClient.js": re.compile(r"createClient"),
}


@pytest.mark.parametrize("path", SENSITIVE_PATHS)
def test_source_and_secret_files_are_not_served(home, path):
    resp = requests.get(SITE_URL + path, timeout=TIMEOUT)
    assert not SENSITIVE_PATHS[path].search(resp.text), f"{path} is publicly readable"


@pytest.fixture(scope="module")
def bundles(home):
    urls = set(re.findall(r'(?:src|href)="([^"]+\.js)"', home.text))
    return {url: requests.get(urljoin(SITE_URL + "/", url), timeout=TIMEOUT) for url in urls}


def test_bundle_found(bundles):
    assert bundles, "No JavaScript bundle found in index.html"


def test_no_privileged_jwt_in_bundle(bundles):
    for url, resp in bundles.items():
        for token in JWT_RE.findall(resp.text):
            role = (decode_jwt_payload(token) or {}).get("role")
            assert role not in ("service_role", "supabase_admin"), f"{role} key shipped in {url}"


SECRET_PATTERNS = {
    "Supabase secret key": re.compile(r"sb_secret_[A-Za-z0-9_-]{10,}"),
    "Resend API key": re.compile(r"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}"),
    "secret env name": re.compile(r"SERVICE_ROLE|RESEND_API_KEY|GEOCODIO_API_KEY|WEBHOOK_SECRET|REVIEW_LINK_SECRET|CRON_SECRET"),
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}


@pytest.mark.parametrize("label", SECRET_PATTERNS)
def test_no_secrets_in_bundle(bundles, label):
    for url, resp in bundles.items():
        match = SECRET_PATTERNS[label].search(resp.text)
        assert not match, f"{label} found in {url}: {match.group(0)[:20]}..."


def test_no_source_maps(bundles):
    for url, resp in bundles.items():
        assert "sourceMappingURL" not in resp.text, f"{url} points to a source map"
        map_resp = requests.get(urljoin(SITE_URL + "/", url) + ".map", timeout=TIMEOUT)
        assert '"mappings"' not in map_resp.text, f"{url}.map is public, exposing the original source"

"""8. Stored XSS: script payloads saved through the public form, plus code scans for unsafe rendering."""
import re
import uuid

import pytest

from helpers import MARKER, ROOT, quote_row

XSS_PAYLOADS = [
    "<script>alert(document.cookie)</script>",
    "<img src=x onerror=alert(1)>",
    "\"><svg onload=alert(1)>",
    "javascript:alert(1)",
    "<a href=\"javascript:alert(1)\">click</a>",
    "{{constructor.constructor('alert(1)')()}}",
]


@pytest.mark.parametrize("payload", XSS_PAYLOADS)
def test_xss_payloads_are_stored_as_plain_text(anon, admin, payload):
    """React escapes text when rendering, so the payload must come back exactly as typed (never 'cleaned' into HTML)."""
    name = f"{MARKER} xss {uuid.uuid4().hex[:6]}"
    resp = anon.rest("POST", "quotes", prefer="return=minimal",
                     json_body=quote_row(customer_name=name, message=payload, address=payload, service=payload))
    assert resp.status_code == 201, resp.text[:300]
    stored = admin.rest("GET", "quotes", params={"select": "message,address,service", "customer_name": f"eq.{name}"}).json()
    assert stored == [{"message": payload, "address": payload, "service": payload}]


UNSAFE_REACT = [
    (re.compile(r"dangerouslySetInnerHTML"), "dangerouslySetInnerHTML"),
    (re.compile(r"\.innerHTML\s*="), "innerHTML assignment"),
    (re.compile(r"\.outerHTML\s*="), "outerHTML assignment"),
    (re.compile(r"insertAdjacentHTML"), "insertAdjacentHTML"),
    (re.compile(r"document\.write"), "document.write"),
    (re.compile(r"\beval\s*\("), "eval()"),
    (re.compile(r"new\s+Function\s*\("), "new Function()"),
]


def scan(files, patterns):
    hits = []
    for path in files:
        for number, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            for regex, label in patterns:
                if regex.search(line):
                    hits.append(f"{path.relative_to(ROOT)}:{number} {label}: {line.strip()[:120]}")
    return hits


def test_frontend_has_no_unsafe_html_rendering():
    files = [p for p in (ROOT / "src").rglob("*") if p.suffix in (".js", ".jsx", ".ts", ".tsx")
             and ".test." not in p.name]
    hits = scan(files, UNSAFE_REACT)
    assert not hits, "Unsafe HTML rendering in the frontend:\n" + "\n".join(hits)


def test_frontend_links_do_not_use_raw_user_urls():
    """href={someValue} built from customer data can carry javascript: URLs."""
    files = [p for p in (ROOT / "src").rglob("*.jsx") if ".test." not in p.name]
    pattern = [(re.compile(r"href=\{\s*(quote|review|appointment|record|row|data|form|user)\w*\.\w+"), "user data in href")]
    hits = scan(files, pattern)
    assert not hits, "Links built from user data:\n" + "\n".join(hits)


# Customer data put into email HTML without escapeHtml()
RAW_EMAIL_VALUE = re.compile(r"\$\{\s*(record|r|oldRecord|old_record|old|body|appointment|quote|row|data)\b(?![^}]*escapeHtml)[^}]*\}")


def test_email_html_escapes_customer_data():
    hits = []
    for path in (ROOT / "supabase" / "functions").rglob("*.ts"):
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "<" in line and RAW_EMAIL_VALUE.search(line):
                hits.append(f"{path.relative_to(ROOT)}:{number}: {line.strip()[:140]}")
    assert not hits, "Customer data placed in email HTML without escapeHtml():\n" + "\n".join(hits)

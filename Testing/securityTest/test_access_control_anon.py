"""2. Broken access control: what a visitor with no account can reach."""
import uuid

import pytest

from conftest import QUOTE_TABLES, read_canary
from helpers import (
    MARKER, assert_blocked_or_empty, assert_insert_blocked, assert_no_leak, rows_of, quote_row,
)

PRIVATE_TABLES = ["quotes", "accepted_quotes", "declined_quotes", "profiles", "settings", "appointment_completions"]
# Tables anyone may read (the public site shows them)
PUBLIC_READ = {"services", "customer_reviews"}


@pytest.mark.parametrize("table", PRIVATE_TABLES)
def test_anon_cannot_read_private_tables(anon, table):
    resp = anon.rest("GET", table, params={"select": "*", "limit": 5})
    assert_blocked_or_empty(resp, f"anon read {table}")


def test_anon_only_sees_approved_reviews(anon):
    resp = anon.rest("GET", "customer_reviews", params={"select": "*", "limit": 200})
    assert_no_leak(resp)
    rows = rows_of(resp)
    hidden = [r for r in rows if r.get("approved") is not True]
    assert not hidden, f"Anonymous visitor can read {len(hidden)} unapproved review(s)"
    leaked = [k for r in rows for k in ("user_id", "email") if r.get(k)]
    assert not leaked, f"Public reviews expose private fields: {sorted(set(leaked))}"


def test_every_exposed_table_is_locked(anon):
    """Read the API schema the way an attacker maps the site, then try every table it lists."""
    resp = anon.rest("GET", "")
    if resp.status_code != 200:
        pytest.skip(f"API schema is hidden from anonymous users ({resp.status_code}), which is good")
    paths = resp.json().get("paths", {})
    tables = sorted({p.strip("/") for p in paths if p.count("/") == 1 and p != "/" and not p.startswith("/rpc")})
    readable = []
    for table in tables:
        if table in PUBLIC_READ:
            continue
        rows = rows_of(anon.rest("GET", table, params={"select": "*", "limit": 1}))
        if rows:
            readable.append(table)
    assert not readable, f"Anonymous visitors can read rows from: {readable}"


@pytest.mark.parametrize("table", QUOTE_TABLES)
def test_anon_cannot_update_quote_rows(anon, admin, canaries, table):
    canary = canaries[table]
    resp = anon.rest("PATCH", table, params={"id": f"eq.{canary['id']}"},
                     json_body={"message": f"{MARKER} PWNED"}, prefer="return=representation")
    assert_blocked_or_empty(resp, f"anon update {table}")
    assert read_canary(admin, table, canary["id"])["message"] == canary["message"], f"anon changed a {table} row"


@pytest.mark.parametrize("table", QUOTE_TABLES)
def test_anon_cannot_delete_quote_rows(anon, admin, canaries, table):
    canary = canaries[table]
    resp = anon.rest("DELETE", table, params={"id": f"eq.{canary['id']}"}, prefer="return=representation")
    assert_blocked_or_empty(resp, f"anon delete {table}")
    assert read_canary(admin, table, canary["id"]) is not None, f"anon DELETED a {table} row"


@pytest.mark.parametrize("table", ["accepted_quotes", "declined_quotes"])
def test_anon_cannot_insert_into_admin_tables(anon, table):
    row = quote_row(customer_name=f"{MARKER} anon insert {table}")
    if table == "accepted_quotes":
        row["status"] = "accepted"
    else:
        row.pop("status")
        row["decline_reason"] = "x"
    resp = anon.rest("POST", table, json_body=row, prefer="return=minimal")
    assert_insert_blocked(resp, f"anon insert {table}")


def test_anon_quote_insert_works_but_cannot_be_read_back(anon, admin):  # admin: needed to clean up
    name = f"{MARKER} readback {uuid.uuid4().hex[:6]}"
    resp = anon.rest("POST", "quotes", json_body=quote_row(customer_name=name), prefer="return=minimal")
    assert resp.status_code == 201, f"The public quote form is broken: {resp.text[:300]}"
    back = anon.rest("GET", "quotes", params={"select": "*", "customer_name": f"eq.{name}"})
    assert_blocked_or_empty(back, "anon read back its own quote")
    rep = anon.rest("POST", "quotes", json_body=quote_row(customer_name=name + "b"), prefer="return=representation")
    assert rep.status_code != 201 or rep.json() == [], "return=representation hands quote rows back to anonymous users"


def test_anon_cannot_set_quote_status(anon, admin):
    """Low severity: the form always sends 'pending'; an attacker could send anything."""
    name = f"{MARKER} status {uuid.uuid4().hex[:6]}"
    resp = anon.rest("POST", "quotes", json_body=quote_row(customer_name=name, status="accepted"), prefer="return=minimal")
    if resp.status_code != 201:
        return  # rejected outright: good
    stored = admin.rest("GET", "quotes", params={"select": "status", "customer_name": f"eq.{name}"}).json()
    assert stored and stored[0]["status"] == "pending", f"Anonymous user stored a quote with status {stored}"


@pytest.mark.parametrize("approved", [False, True])
def test_anon_cannot_insert_reviews(anon, approved):
    resp = anon.rest("POST", "customer_reviews", prefer="return=minimal", json_body={
        "customer_name": f"{MARKER} anon review", "review": f"{MARKER} fake", "rating": 5, "approved": approved,
    })
    assert_insert_blocked(resp, f"anon review insert approved={approved}")


def test_anon_cannot_write_services(anon):
    resp = anon.rest("POST", "services", prefer="return=minimal",
                     json_body={"name": f"{MARKER} service", "image_path": f"{MARKER}.jpg"})
    assert_insert_blocked(resp, "anon insert services")
    real = anon.rest("GET", "services", params={"select": "id,name", "limit": 1}).json()
    if real:
        # Writes the same name back, so nothing changes even if this gets through
        resp = anon.rest("PATCH", "services", params={"id": f"eq.{real[0]['id']}"},
                         json_body={"name": real[0]["name"]}, prefer="return=representation")
        assert_blocked_or_empty(resp, "anon update services")


def test_anon_cannot_promote_a_profile(anon, customer):
    resp = anon.rest("PATCH", "profiles", params={"id": f"eq.{customer.user_id}"},
                     json_body={"is_admin": True}, prefer="return=representation")
    assert_blocked_or_empty(resp, "anon update profiles")


def test_anon_cannot_write_settings(anon, customer):
    resp = anon.rest("POST", "settings", prefer="return=minimal",
                     json_body={"user_id": customer.user_id, "phone_number": "0000000000"})
    assert_insert_blocked(resp, "anon insert settings")

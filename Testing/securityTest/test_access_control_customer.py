"""3. Broken access control: what a signed-in customer can reach beyond their own data."""
import uuid

import pytest

from conftest import QUOTE_TABLES, read_canary
from helpers import (
    MARKER, assert_blocked_or_empty, assert_insert_blocked, assert_no_leak, rows_of,
)


def my_profile(client):
    rows = client.rest("GET", "profiles", params={"select": "*", "id": f"eq.{client.user_id}"}).json()
    return rows[0] if rows else {}


def restore_customer(admin, customer):
    """If an escalation worked, undo it before anything else runs."""
    admin.rest("PATCH", "profiles", params={"id": f"eq.{customer.user_id}"}, json_body={"is_admin": False})
    if my_profile(customer).get("is_admin"):
        print(f"\n!!! Test customer {customer.email} is STILL ADMIN. Set profiles.is_admin = false by hand NOW.")


def test_customer_cannot_make_themselves_admin(customer, admin):
    resp = customer.rest("PATCH", "profiles", params={"id": f"eq.{customer.user_id}"},
                         json_body={"is_admin": True}, prefer="return=representation")
    assert_no_leak(resp)
    escalated = my_profile(customer).get("is_admin")
    if escalated:
        restore_customer(admin, customer)
    assert not escalated, "CRITICAL: a customer made themselves admin with one PATCH request"


def test_customer_cannot_upsert_admin_profile(customer, admin):
    resp = customer.rest("POST", "profiles", json_body={"id": customer.user_id, "is_admin": True},
                         prefer="resolution=merge-duplicates,return=representation")
    assert_no_leak(resp)
    escalated = my_profile(customer).get("is_admin")
    if escalated:
        restore_customer(admin, customer)
    assert not escalated, "CRITICAL: a customer made themselves admin through an upsert"


def test_customer_cannot_create_a_second_admin_profile(customer):
    resp = customer.rest("POST", "profiles", json_body={"id": str(uuid.uuid4()), "is_admin": True}, prefer="return=minimal")
    assert_insert_blocked(resp, "customer insert profile for another id")


def test_customer_cannot_read_other_profiles(customer, admin):
    resp = customer.rest("GET", "profiles", params={"select": "*", "id": f"eq.{admin.user_id}"})
    assert_blocked_or_empty(resp, "customer read admin profile")
    rows = rows_of(customer.rest("GET", "profiles", params={"select": "id", "limit": 50}))
    others = [r for r in rows if r.get("id") != customer.user_id]
    assert not others, f"Customer can list {len(others)} other user profile(s)"


def test_customer_cannot_read_other_settings(customer):
    resp = customer.rest("GET", "settings", params={"select": "*", "user_id": f"neq.{customer.user_id}", "limit": 5})
    assert_blocked_or_empty(resp, "customer read other users' settings")


def test_customer_cannot_change_other_settings(customer, admin):
    before = admin.rest("GET", "settings", params={"select": "phone_number", "user_id": f"eq.{admin.user_id}"}).json()
    resp = customer.rest("PATCH", "settings", params={"user_id": f"eq.{admin.user_id}"},
                         json_body={"phone_number": "0000000000"}, prefer="return=representation")
    assert_no_leak(resp)
    after = admin.rest("GET", "settings", params={"select": "phone_number", "user_id": f"eq.{admin.user_id}"}).json()
    if before and after != before:
        admin.rest("PATCH", "settings", params={"user_id": f"eq.{admin.user_id}"}, json_body=before[0])
    assert after == before, "Customer changed another user's settings (IDOR)"


def test_customer_cannot_take_over_other_settings_by_upsert(customer, admin):
    resp = customer.rest("POST", "settings", json_body={"user_id": admin.user_id, "phone_number": "0000000000"},
                         prefer="resolution=merge-duplicates,return=minimal")
    assert_insert_blocked(resp, "customer upsert settings for another user")


@pytest.mark.parametrize("table", QUOTE_TABLES)
def test_customer_only_sees_own_quotes(customer, table):
    resp = customer.rest("GET", table, params={"select": "*", "limit": 200})
    assert_no_leak(resp)
    rows = rows_of(resp)
    foreign = [r for r in rows if (r.get("email") or "").lower() != customer.email.lower()]
    assert not foreign, f"Customer can read {len(foreign)} other customer row(s) in {table}"


def test_customer_cannot_read_completion_notes(customer):
    resp = customer.rest("GET", "appointment_completions", params={"select": "*", "limit": 5})
    assert_blocked_or_empty(resp, "customer read appointment_completions")


@pytest.mark.parametrize("table", QUOTE_TABLES)
def test_customer_cannot_change_or_delete_quotes(customer, admin, canaries, table):
    canary = canaries[table]
    patch = customer.rest("PATCH", table, params={"id": f"eq.{canary['id']}"},
                          json_body={"message": f"{MARKER} PWNED"}, prefer="return=representation")
    assert_blocked_or_empty(patch, f"customer update {table}")
    delete = customer.rest("DELETE", table, params={"id": f"eq.{canary['id']}"}, prefer="return=representation")
    assert_blocked_or_empty(delete, f"customer delete {table}")
    row = read_canary(admin, table, canary["id"])
    assert row is not None and row["message"] == canary["message"], f"Customer changed or deleted a {table} row"


def review(customer, **overrides):
    body = {
        "user_id": customer.user_id,
        "customer_name": f"{MARKER} review {uuid.uuid4().hex[:6]}",
        "review": f"{MARKER} automated security test",
        "rating": 4,
        "approved": False,
    }
    body.update(overrides)
    return body


def test_customer_cannot_self_approve_review(customer, admin):
    body = review(customer, approved=True)
    resp = customer.rest("POST", "customer_reviews", json_body=body, prefer="return=minimal")
    assert_no_leak(resp)
    if resp.status_code != 201:
        return  # rejected outright: good
    stored = admin.rest("GET", "customer_reviews", params={"select": "approved", "customer_name": f"eq.{body['customer_name']}"}).json()
    assert stored and stored[0]["approved"] is False, "Customer published their own review without admin approval"


def test_customer_cannot_approve_review_after_insert(customer, admin):
    body = review(customer)
    customer.rest("POST", "customer_reviews", json_body=body, prefer="return=minimal")
    customer.rest("PATCH", "customer_reviews", params={"customer_name": f"eq.{body['customer_name']}"},
                  json_body={"approved": True})
    stored = admin.rest("GET", "customer_reviews", params={"select": "approved", "customer_name": f"eq.{body['customer_name']}"}).json()
    assert not stored or stored[0]["approved"] is False, "Customer approved their own review with a PATCH"


def test_customer_cannot_review_as_someone_else(customer, admin):
    resp = customer.rest("POST", "customer_reviews", json_body=review(customer, user_id=admin.user_id), prefer="return=minimal")
    assert_insert_blocked(resp, "customer review with a forged user_id")


@pytest.mark.parametrize("rating", [99, 0, -1, 6, 4.5])
def test_customer_cannot_submit_out_of_range_rating(customer, rating):
    resp = customer.rest("POST", "customer_reviews", json_body=review(customer, rating=rating), prefer="return=minimal")
    assert_insert_blocked(resp, f"review with rating {rating}")


def test_customer_cannot_submit_huge_review(customer):
    resp = customer.rest("POST", "customer_reviews", prefer="return=minimal",
                         json_body=review(customer, review=f"{MARKER} " + "A" * 100_000))
    assert_insert_blocked(resp, "100 KB review")


def test_customer_cannot_edit_other_reviews(customer, anon):
    public = anon.rest("GET", "customer_reviews", params={"select": "id,review", "limit": 1}).json()
    if not public:
        pytest.skip("No public reviews to target")
    target = public[0]
    # Writes the same text back, so nothing changes even if this gets through
    resp = customer.rest("PATCH", "customer_reviews", params={"id": f"eq.{target['id']}"},
                         json_body={"review": target["review"]}, prefer="return=representation")
    assert_blocked_or_empty(resp, "customer update another user's review")


def test_customer_cannot_call_admin_sync_function(customer):
    resp = customer.fn("sync-appointment", json_body={"quoteId": str(uuid.uuid4()), "mode": "update"})
    assert resp.status_code in (401, 403), f"{resp.status_code}: {resp.text[:300]}"


def test_customer_cannot_write_services(customer):
    resp = customer.rest("POST", "services", prefer="return=minimal",
                         json_body={"name": f"{MARKER} service", "image_path": f"{MARKER}.jpg"})
    assert_insert_blocked(resp, "customer insert services")

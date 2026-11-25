"""7. Storage: non-admins trying to upload, overwrite, move, delete or list service photos."""
import base64

import pytest

from helpers import MARKER, json_or_none

BUCKET = "service-images"
# A valid 1x1 PNG
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def upload(client, name, body=PNG, content_type="image/png", upsert=False):
    headers = {"Content-Type": content_type}
    if upsert:
        headers["x-upsert"] = "true"
    return client.storage("POST", f"object/{BUCKET}/{name}", data=body, headers=headers)


def exists(admin, name):
    resp = admin.storage("POST", f"object/list/{BUCKET}", json_body={"prefix": "", "search": name, "limit": 10})
    return any(o.get("name") == name for o in resp.json())


@pytest.fixture(scope="module")
def canary_file(admin):
    name = f"{MARKER}-canary.png"
    resp = upload(admin, name)
    assert resp.status_code == 200, f"Admin could not upload the canary file: {resp.text[:300]}"
    return name


@pytest.mark.parametrize("who", ["anon", "customer"])
@pytest.mark.parametrize("name,body,content_type", [
    (f"{MARKER}-upload.png", PNG, "image/png"),
    (f"../{MARKER}-traversal.png", PNG, "image/png"),
    (f"{MARKER}-xss.html", b"<script>alert(document.cookie)</script>", "text/html"),
    (f"{MARKER}-xss.svg", b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "image/svg+xml"),
])
def test_non_admins_cannot_upload(request, who, name, body, content_type):
    resp = upload(request.getfixturevalue(who), name, body, content_type)
    assert resp.status_code >= 400, f"{who} uploaded {name}: {resp.status_code} {resp.text[:300]}"


@pytest.mark.parametrize("who", ["anon", "customer"])
def test_non_admins_cannot_overwrite(request, admin, canary_file, who):
    resp = upload(request.getfixturevalue(who), canary_file, body=PNG + b"tampered", upsert=True)
    assert resp.status_code >= 400, f"{who} overwrote a service photo: {resp.text[:300]}"


@pytest.mark.parametrize("who", ["anon", "customer"])
def test_non_admins_cannot_delete(request, admin, canary_file, who):
    resp = request.getfixturevalue(who).storage("DELETE", f"object/{BUCKET}", json_body={"prefixes": [canary_file]})
    assert resp.status_code >= 400 or json_or_none(resp) == [], f"{who} delete response: {resp.text[:300]}"
    assert exists(admin, canary_file), f"{who} DELETED a service photo"


@pytest.mark.parametrize("who", ["anon", "customer"])
def test_non_admins_cannot_move(request, admin, canary_file, who):
    resp = request.getfixturevalue(who).storage("POST", "object/move", json_body={
        "bucketId": BUCKET, "sourceKey": canary_file, "destinationKey": f"{MARKER}-moved-{who}.png",
    })
    assert resp.status_code >= 400, f"{who} moved a service photo: {resp.text[:300]}"
    assert exists(admin, canary_file)


@pytest.mark.parametrize("who", ["anon", "customer"])
def test_non_admins_cannot_list_bucket(request, who):
    resp = request.getfixturevalue(who).storage("POST", f"object/list/{BUCKET}", json_body={"prefix": "", "limit": 100})
    assert resp.status_code >= 400 or json_or_none(resp) == [], f"{who} can list every file: {resp.text[:300]}"


def test_non_admins_cannot_create_buckets(customer):
    resp = customer.storage("POST", "bucket", json_body={"id": MARKER.lower(), "name": MARKER.lower(), "public": True})
    assert resp.status_code >= 400, f"Customer created a storage bucket: {resp.text[:300]}"

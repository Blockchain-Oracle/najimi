"""
Najimi's social bridge: Instagram (instagrapi) for the worker and the web server.

TikTok isn't here: TikTokApi 7.3.3 gets empty answers from TikTok, and TikTok's web API returns
empty video lists to headless browsers (both checked 2026-10-22), so TikTok taste comes from the
person's own data export and the tune-up opens TikTok itself.

Internal only (no public route). Stateless: every call brings the session it acts with, already
opened by the worker from its sealed row, and gets the session's updated settings back to seal
again. Nothing is written to disk. Every call needs the shared bearer token.
"""

from __future__ import annotations

import base64
import hmac
import os
import tempfile
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    ChallengeRequired,
    ClientError,
    FeedbackRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
    PrivateAccount,
    RateLimitError,
    UserNotFound,
)
from pydantic import BaseModel, Field

TOKEN = os.environ.get("SOCIAL_BRIDGE_TOKEN", "")
# Pause between Instagram requests, in seconds (instagrapi's own pacing).
IG_DELAY = [1, 3]
READ_MAX = 200

app = FastAPI(title="najimi-social-bridge", docs_url=None, redoc_url=None, openapi_url=None)


def authorised(authorization: str = Header(default="")) -> None:
    expected = f"Bearer {TOKEN}"
    if not TOKEN or not hmac.compare_digest(authorization.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail={"error": "Not allowed", "code": "auth"})


def refused(code: str, message: str, status: int = 409) -> HTTPException:
    return HTTPException(status_code=status, detail={"error": message, "code": code})


def instagram_error(e: Exception) -> HTTPException:
    """What went wrong, in the words the app shows, and whether to stop for the day."""
    if isinstance(e, (ChallengeRequired,)):
        return refused("challenge", "Instagram wants you to confirm it's you. Open Instagram, then connect again.")
    if isinstance(e, (LoginRequired, BadPassword)):
        return refused("login", "Instagram signed this session out. Connect again.")
    if isinstance(e, FeedbackRequired):
        return refused("feedback", "Instagram is limiting actions on this account for now.")
    if isinstance(e, (PleaseWaitFewMinutes, RateLimitError)):
        return refused("wait", "Instagram asked to slow down. Najimi will try again later.")
    if isinstance(e, PrivateAccount):
        return refused("private", "That account is private.")
    if isinstance(e, UserNotFound):
        return refused("not_found", "No Instagram account by that name.", 404)
    if isinstance(e, ClientError):
        return refused("platform", f"Instagram said no: {str(e)[:160]}")
    return refused("bridge", f"Instagram couldn't be reached: {type(e).__name__}", 502)


def ig_client(settings: dict[str, Any] | None = None) -> Client:
    cl = Client()
    cl.delay_range = IG_DELAY
    if settings:
        cl.set_settings(settings)
    return cl


def short(u: Any) -> dict[str, Any]:
    return {
        "id": str(u.pk),
        "username": u.username,
        "name": getattr(u, "full_name", None) or None,
        "image": str(u.profile_pic_url) if getattr(u, "profile_pic_url", None) else None,
    }


def music_of(media: Any) -> dict[str, str] | None:
    """The song on a reel, when Instagram names one."""
    clips = getattr(media, "clips_metadata", None)
    if clips is None:
        return None
    data = clips if isinstance(clips, dict) else clips.model_dump()
    info = (data.get("music_info") or {}).get("music_asset_info") or {}
    title, artist = info.get("title"), info.get("display_artist")
    return {"title": title, "artist": artist} if title and artist else None


def post_of(media: Any) -> dict[str, Any]:
    return {
        "id": str(media.pk),
        "code": media.code,
        "owner": media.user.username if media.user else None,
        "ownerName": (media.user.full_name or None) if media.user else None,
        "caption": (media.caption_text or "")[:400],
        "music": music_of(media),
    }


# ── Instagram ────────────────────────────────────────────────────────────────────────────────


class IgConnect(BaseModel):
    sessionid: str = Field(min_length=30, max_length=400)


@app.post("/instagram/connect", dependencies=[Depends(authorised)])
def instagram_connect(body: IgConnect) -> dict[str, Any]:
    """Signs in with the person's own session cookie and says whose account it is."""
    cl = ig_client()
    try:
        cl.login_by_sessionid(body.sessionid.strip())
        me = cl.account_info()
    except AssertionError:
        raise refused("invalid", "That doesn't look like an Instagram sessionid.", 400)
    except ChallengeRequired as e:
        raise instagram_error(e)
    except Exception:  # noqa: BLE001 — a session Instagram doesn't know reads as "copy it again"
        raise refused("login", "Instagram didn't accept that sessionid. Copy it again from instagram.com.")
    return {"settings": cl.get_settings(), "account": short(me)}


class IgRead(BaseModel):
    settings: dict[str, Any]
    what: Literal["following", "liked", "saved"]
    # Someone else's following (pool sessions only); the account's own when empty.
    username: str | None = None
    max: int = Field(default=READ_MAX, ge=1, le=READ_MAX)


@app.post("/instagram/read", dependencies=[Depends(authorised)])
def instagram_read(body: IgRead) -> dict[str, Any]:
    cl = ig_client(body.settings)
    try:
        if body.what == "following":
            target = cl.user_id_from_username(body.username) if body.username else str(cl.user_id)
            people = cl.user_following(target, amount=body.max)
            return {"settings": cl.get_settings(), "accounts": [short(u) for u in people.values()]}
        medias = (
            cl.liked_medias(amount=body.max)
            if body.what == "liked"
            else cl.collection_medias("saved", amount=body.max)
        )
        return {"settings": cl.get_settings(), "posts": [post_of(m) for m in medias]}
    except Exception as e:  # noqa: BLE001
        raise instagram_error(e)


class IgAct(BaseModel):
    settings: dict[str, Any]
    action: Literal["follow", "like", "save", "like_latest"]
    # A username to follow or whose newest post to like, or a post's code (from its URL) to like
    # or save.
    target: str = Field(min_length=1, max_length=120)


@app.post("/instagram/act", dependencies=[Depends(authorised)])
def instagram_act(body: IgAct) -> dict[str, Any]:
    cl = ig_client(body.settings)
    try:
        if body.action == "follow":
            ok = cl.user_follow(cl.user_id_from_username(body.target.lstrip("@")))
            url = f"https://www.instagram.com/{body.target.lstrip('@')}/"
        elif body.action == "like_latest":
            medias = cl.user_medias(cl.user_id_from_username(body.target.lstrip("@")), amount=1)
            if not medias:
                return {"settings": cl.get_settings(), "ok": False, "url": ""}
            ok = cl.media_like(medias[0].id)
            url = f"https://www.instagram.com/p/{medias[0].code}/"
        else:
            media_id = cl.media_id(cl.media_pk_from_code(body.target))
            ok = cl.media_like(media_id) if body.action == "like" else cl.media_save(media_id)
            url = f"https://www.instagram.com/p/{body.target}/"
    except Exception as e:  # noqa: BLE001
        raise instagram_error(e)
    return {"settings": cl.get_settings(), "ok": bool(ok), "url": url}


class IgPost(BaseModel):
    settings: dict[str, Any]
    caption: str = Field(max_length=2200)
    # The picture, as base64 JPEG (the worker sends it; the bridge reaches nothing else).
    image: str = Field(min_length=100, max_length=12_000_000)


@app.post("/instagram/post", dependencies=[Depends(authorised)])
def instagram_post(body: IgPost) -> dict[str, Any]:
    cl = ig_client(body.settings)
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "post.jpg"
        path.write_bytes(base64.b64decode(body.image))
        try:
            media = cl.photo_upload(path, body.caption)
        except Exception as e:  # noqa: BLE001
            raise instagram_error(e)
    return {"settings": cl.get_settings(), "url": f"https://www.instagram.com/p/{media.code}/"}


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}

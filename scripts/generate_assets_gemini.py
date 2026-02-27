#!/usr/bin/env python3
import argparse
import base64
import hashlib
import json
import os
import pathlib
import sys
import time
from typing import Any

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None

try:
    from PIL import Image, ImageDraw, ImageFont  # type: ignore
except Exception as exc:  # pragma: no cover
    raise RuntimeError("Pillow is required for placeholder generation") from exc


def load_jobs(path: pathlib.Path) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            jobs.append(json.loads(line))
    return jobs


def placeholder_image(job: dict[str, Any], out_path: pathlib.Path) -> None:
    digest = hashlib.sha1((job.get("prompt", "") + job.get("output_name", "")).encode("utf-8")).hexdigest()
    color = (int(digest[0:2], 16), int(digest[2:4], 16), int(digest[4:6], 16), 255)
    image = Image.new("RGBA", (1024, 1024), color)
    draw = ImageDraw.Draw(image)
    text = job.get("metadata", {}).get("id", job.get("output_name", "asset"))
    draw.rectangle((40, 40, 984, 180), fill=(0, 0, 0, 120))
    draw.text((60, 90), text, fill=(255, 255, 255, 255), font=ImageFont.load_default())
    image.save(out_path)


def try_generate_with_gemini(
    job: dict[str, Any],
    model: str,
    api_key: str,
    out_path: pathlib.Path,
    timeout_s: int,
    image_aspect_ratio: str,
    image_size: str,
    request_retries: int,
    use_proxy: bool,
) -> tuple[bool, bool]:
    if requests is None:
        return (False, True)

    prompt = job.get("prompt", "")
    constraints = job.get("constraints", "")
    full_prompt = f"{prompt}\nConstraints: {constraints}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": full_prompt
                    }
                ],
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
            "imageConfig": {"aspectRatio": image_aspect_ratio, "imageSize": image_size},
        },
    }

    session = requests.Session()
    session.trust_env = use_proxy

    body: dict[str, Any] = {}
    last_fatal = False
    for attempt in range(request_retries + 1):
        try:
            response = session.post(url, params={"key": api_key}, json=payload, timeout=timeout_s)
            response.raise_for_status()
            body = response.json()
            break
        except Exception as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            fatal = status_code in {400, 401, 403, 404}
            last_fatal = bool(fatal)
            if fatal or attempt >= request_retries:
                return (False, last_fatal)
            time.sleep(1.0)

    candidates = body.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content", {})
        for part in content.get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if not inline:
                continue
            data = inline.get("data")
            if not data:
                continue
            try:
                out_path.write_bytes(base64.b64decode(data))
                return (True, False)
            except Exception:
                continue

    return (False, False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate asset images via Gemini with placeholder fallback")
    parser.add_argument("--input", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--model", default=os.getenv("IMAGE_MODEL", "gemini-3.1-flash-image-preview"))
    parser.add_argument("--delay-ms", type=int, default=int(os.getenv("GEMINI_REQUEST_DELAY_MS", "1200")))
    parser.add_argument("--timeout-s", type=int, default=int(os.getenv("GEMINI_REQUEST_TIMEOUT_S", "20")))
    parser.add_argument("--image-aspect-ratio", default=os.getenv("GEMINI_IMAGE_ASPECT_RATIO", "1:1"))
    parser.add_argument("--image-size", default=os.getenv("GEMINI_IMAGE_SIZE", "1K"))
    parser.add_argument("--request-retries", type=int, default=int(os.getenv("GEMINI_REQUEST_RETRIES", "1")))
    parser.add_argument("--use-proxy", action="store_true", default=os.getenv("GEMINI_USE_PROXY", "").lower() in {"1", "true", "yes"})
    args = parser.parse_args()

    input_path = pathlib.Path(args.input)
    out_dir = pathlib.Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    jobs = load_jobs(input_path)
    api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_enabled = bool(api_key)

    for job in jobs:
        output_name = job.get("output_name") or job.get("out")
        if not output_name:
            continue
        out_path = out_dir / output_name

        ok = False
        fatal_error = False
        if gemini_enabled:
            ok, fatal_error = try_generate_with_gemini(
                job,
                args.model,
                api_key,
                out_path,
                args.timeout_s,
                args.image_aspect_ratio,
                args.image_size,
                args.request_retries,
                args.use_proxy,
            )
            if args.delay_ms > 0:
                time.sleep(args.delay_ms / 1000.0)
            if fatal_error:
                gemini_enabled = False
                print(
                    "[gemini-disabled] fatal API error detected, fallback to placeholders for remaining assets",
                    flush=True,
                )

        if not ok:
            placeholder_image(job, out_path)
            print(f"[placeholder] {out_path.name}", flush=True)
        else:
            print(f"[gemini] {out_path.name}", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())

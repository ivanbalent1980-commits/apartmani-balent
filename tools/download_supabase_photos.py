from __future__ import annotations

import argparse
import concurrent.futures
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps


SUPABASE_PUBLIC_BASE = (
    "https://xtvgkraqccsuonqhaeab.supabase.co/storage/v1/object/public/"
)


def public_url(bucket: str, filename: str) -> str:
    return (
        SUPABASE_PUBLIC_BASE
        + urllib.parse.quote(bucket, safe="")
        + "/"
        + urllib.parse.quote(filename, safe="")
    )


def optimize(source: Path, target: Path, max_width: int, quality: int) -> None:
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        if image.width > max_width:
            height = round(image.height * (max_width / image.width))
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "WEBP", quality=quality, method=6)


def process_one(
    bucket: str,
    source_name: str,
    target: Path,
    max_width: int,
    quality: int,
) -> str:
    if target.exists() and target.stat().st_size > 0:
        return f"skip {target.name}"

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / source_name
        request = urllib.request.Request(
            public_url(bucket, source_name),
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            temp_path.write_bytes(response.read())
        optimize(temp_path, target, max_width, quality)

    return f"ok {source_name} -> {target.name}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download public Supabase photos and create optimized local web assets."
    )
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--first", type=int, required=True)
    parser.add_argument("--last", type=int, required=True)
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--output-prefix", required=True)
    parser.add_argument("--source-prefix", default="Apartmani Balent-")
    parser.add_argument("--max-width", type=int, default=1800)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    jobs = []
    for output_index, number in enumerate(range(args.first, args.last + 1), start=1):
        source_name = f"{args.source_prefix}{number}.jpg"
        target = args.target / f"{args.output_prefix}-{output_index:03d}.webp"
        jobs.append((args.bucket, source_name, target, args.max_width, args.quality))

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(process_one, *job) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            print(future.result())

    print(f"Done: {len(jobs)} files in {args.target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

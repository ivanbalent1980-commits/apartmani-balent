from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path
from PIL import Image, ImageOps


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def iter_images(source: Path):
    def natural_key(path: Path):
        return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", path.name)]

    for path in sorted(source.iterdir(), key=natural_key):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            yield path


def optimize_image(source: Path, target: Path, max_width: int, quality: int, keep_smaller_original: bool) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_target = target.with_suffix(".tmp.webp")
    with Image.open(source) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")
        if img.width > max_width:
            height = round(img.height * (max_width / img.width))
            img = img.resize((max_width, height), Image.Resampling.LANCZOS)
        img.save(temp_target, "WEBP", quality=quality, method=6)

    if keep_smaller_original and temp_target.stat().st_size >= source.stat().st_size:
        temp_target.unlink(missing_ok=True)
        original_target = target.with_suffix(source.suffix.lower())
        shutil.copy2(source, original_target)
        return original_target

    temp_target.replace(target)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Optimize apartment photos for the static Netlify deploy."
    )
    parser.add_argument("source", type=Path, help="Folder with original photos")
    parser.add_argument("target", type=Path, help="Folder for optimized .webp files")
    parser.add_argument("--prefix", default="photo", help="Output filename prefix")
    parser.add_argument("--max-width", type=int, default=1800)
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument(
        "--keep-smaller-original",
        action="store_true",
        help="Keep the original file when WebP output would be larger.",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Source folder does not exist: {args.source}")

    images = list(iter_images(args.source))
    if not images:
        raise SystemExit(f"No images found in: {args.source}")

    for index, source in enumerate(images, start=1):
        target = args.target / f"{args.prefix}-{index:03d}.webp"
        written = optimize_image(source, target, args.max_width, args.quality, args.keep_smaller_original)
        original_kb = os.path.getsize(source) // 1024
        optimized_kb = os.path.getsize(written) // 1024
        print(f"{source.name} -> {written.name} ({original_kb} KB -> {optimized_kb} KB)")

    print(f"Optimized {len(images)} images into {args.target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

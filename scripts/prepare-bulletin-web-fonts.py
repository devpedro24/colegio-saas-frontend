"""Development only: lossless WOFF2 conversion. Requires fonttools[woff]."""
import argparse
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont


def compress(source, target):
    font = TTFont(source)
    font.flavor = 'woff2'
    font.save(target)
    restored = TTFont(target)
    if (font.getGlyphOrder() != restored.getGlyphOrder()
            or font.getBestCmap() != restored.getBestCmap()
            or font['hmtx'].metrics != restored['hmtx'].metrics):
        raise RuntimeError(f'WOFF2 verification failed: {source}')
    font.close()
    restored.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Directory containing the original assets/fonts tree')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1] / 'public/bulletin-editor'
    manifest_path = root / 'assets/fonts/catalog/manifest.json'
    entries = json.loads(manifest_path.read_text(encoding='utf-8'))
    for entry in entries:
        source = args.source / 'catalog' / entry['key'] / 'font.ttf'
        target = root / 'assets/fonts/catalog' / entry['key'] / 'font.woff2'
        compress(source, target)
        entry.update(file=target.relative_to(root).as_posix(), bytes=target.stat().st_size,
                     sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                     source_sha256=hashlib.sha256(source.read_bytes()).hexdigest())
        print(entry['family'], entry['bytes'])
    compress(args.source / 'inter-latin.ttf', root / 'assets/fonts/inter-latin.woff2')
    manifest_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    css = root / 'assets/catalog-fonts.css'
    css.write_text(css.read_text(encoding='utf-8').replace('font.ttf', 'font.woff2').replace('format("truetype")', 'format("woff2")'), encoding='utf-8')
    css = root / 'styles.css'
    css.write_text(css.read_text(encoding='utf-8').replace('inter-latin.ttf', 'inter-latin.woff2').replace("format('truetype')", "format('woff2')"), encoding='utf-8')


if __name__ == '__main__':
    main()

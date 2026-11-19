"""Build the public website without copying server code or deployment files."""
import argparse
import json
import shutil
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--revision', required=True)
a = p.parse_args()
source, output = a.source.resolve(), a.output.resolve()
assert source.is_dir(), source
assert output != source and source not in output.parents, 'Output must be outside source'
output.mkdir(parents=True, exist_ok=False)
required = ['index.html', 'league.html', 'lectures.html', 'cinema.html', 'brand.html',
            'style.css', 'home.css', 'home.js', 'league.css', 'app.js', 'league-motion.js',
            'projects.css', 'projects.js', 'topic-config.js', 'topic-form.js', 'data.json']
for name in required:
    assert (source / name).is_file(), f'Missing required file: {name}'
    shutil.copy2(source / name, output / name)
for name in ['assets', 'brand-assets']:
    assert (source / name).is_dir(), name
    for path in (source / name).rglob('*'):
        assert not path.is_symlink(), f'Symlink in assets: {path}'
    shutil.copytree(source / name, output / name)
assert isinstance(json.loads((output / 'data.json').read_text(encoding='utf-8')), list)
missing = []
class Check(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key not in ('href', 'src') or not value:
                continue
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            path = (output / unquote(url.path.lstrip('/'))).resolve()
            if path != output and output not in path.parents:
                missing.append((self.file, value))
            elif not path.exists():
                missing.append((self.file, value))
for file in output.glob('*.html'):
    parser = Check()
    parser.file = file.name
    parser.feed(file.read_text(encoding='utf-8'))
assert not missing, f'Broken internal links/assets: {missing}'
(output / '__version.json').write_text(json.dumps({'revision': a.revision}), encoding='utf-8')
print(f'Build OK: {a.revision}')

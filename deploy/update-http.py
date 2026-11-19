#!/usr/bin/python3
"""Update a static release from GitHub over IPv4 HTTPS, without Git transport."""
import fcntl
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import quote

BASE = Path('/opt/uralsky-kontekst')
REPO = 'ctiv656-rgb/uralsky-kontekst'
BRANCH = 'server'

def curl(url, output, seconds=45):
    subprocess.run(['/usr/bin/curl', '-4', '--fail', '--silent', '--show-error',
                    '--location', '--connect-timeout', '10', '--max-time', str(seconds),
                    '--retry', '1', '--output', str(output), url], check=True)

def link_atomic(name, target, stage):
    temp = stage / name
    temp.symlink_to(target)
    os.replace(temp, BASE / name)

def main():
    os.umask(0o022)
    with (BASE / 'update.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        for name in ['tmp', 'releases', 'sources']:
            (BASE / name).mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='http-release.', dir=BASE / 'tmp') as temp:
            stage = Path(temp)
            info = stage / 'ref.json'
            curl(f'https://api.github.com/repos/{REPO}/git/ref/heads/{BRANCH}', info)
            revision = json.loads(info.read_text())['object']['sha']
            if not re.fullmatch('[0-9a-f]{40}', revision):
                raise ValueError('Invalid revision returned by GitHub')
            target = BASE / 'releases' / revision
            current = BASE / 'current'
            if current.is_symlink() and current.resolve() == target:
                print('Already current:', revision)
                return
            # Some hosts allow raw HTTPS files but stall Git upload-pack/codeload
            tree_file = stage / 'tree.json'
            curl(f'https://api.github.com/repos/{REPO}/git/trees/{revision}?recursive=1', tree_file)
            tree = json.loads(tree_file.read_text())
            if tree.get('truncated'):
                raise ValueError('GitHub returned a partial source tree')
            source = stage / 'source'
            source.mkdir()
            cache = BASE / 'source-current'
            manifest = cache / '.source-tree.json'
            cached = json.loads(manifest.read_text()) if manifest.is_file() else {}
            files = [entry for entry in tree['tree'] if entry['type'] == 'blob']
            def download(entry):
                relative = Path(entry['path'])
                path = (source / relative).resolve()
                if source.resolve() not in path.parents or entry['mode'] == '120000':
                    raise ValueError('Unsafe source entry')
                path.parent.mkdir(parents=True, exist_ok=True)
                previous = cache / relative
                if cached.get(entry['path']) == entry['sha'] and previous.is_file():
                    shutil.copyfile(previous, path)
                else:
                    curl(f'https://raw.githubusercontent.com/{REPO}/{revision}/{quote(entry["path"], safe="/")}', path, 300 if entry.get('size', 0) > 1000000 else 45)
                data = path.read_bytes()
                blob = b'blob ' + str(len(data)).encode() + b'\0' + data
                if hashlib.sha1(blob).hexdigest() != entry['sha']:
                    raise ValueError('Source checksum mismatch: ' + entry['path'])
            with ThreadPoolExecutor(max_workers=8) as pool:
                list(pool.map(download, files))
            (source / '.source-tree.json').write_text(json.dumps({e['path']: e['sha'] for e in files}))
            subprocess.run(['/usr/bin/python3', str(source / 'deploy/build.py'),
                            '--source', str(source), '--output', str(stage / 'public'),
                            '--revision', revision], check=True)
            if not target.exists():
                (stage / 'public').rename(target)
            saved_source = BASE / 'sources' / revision
            if not saved_source.exists():
                source.rename(saved_source)
            if current.is_symlink():
                link_atomic('previous', current.resolve(), stage)
            elif current.exists():
                raise ValueError('current must be a symlink')
            link_atomic('current', target, stage)
            link_atomic('source-current', saved_source, stage)
            print('Published revision:', revision)

if __name__ == '__main__':
    main()

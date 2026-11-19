#!/usr/bin/python3
"""Update a static release from GitHub over IPv4 HTTPS, without Git transport."""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile

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
            archive = stage / 'source.zip'
            curl(f'https://codeload.github.com/{REPO}/zip/{revision}', archive, 120)
            unpack = stage / 'unpack'
            unpack.mkdir()
            with zipfile.ZipFile(archive) as z:
                for item in z.infolist():
                    path = (unpack / item.filename).resolve()
                    if unpack.resolve() not in path.parents:
                        raise ValueError('Unsafe archive path')
                    if stat.S_ISLNK(item.external_attr >> 16):
                        raise ValueError('Unexpected symlink in source archive')
                z.extractall(unpack)
            roots = list(unpack.iterdir())
            if len(roots) != 1 or not roots[0].is_dir():
                raise ValueError('Unexpected source layout')
            source = roots[0]
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

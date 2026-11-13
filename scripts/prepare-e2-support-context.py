"""Prepare isolated Linux/amd64 support-image contexts; no database connections.

Requires Go 1.27.4 (GO_EXECUTABLE or PATH). Downloads source/package archives
from their maintainers and checks pinned SHA-256 before extracting selected files.
The generated binaries/contexts belong outside the repository, never in Git.
"""
import argparse, base64, hashlib, io, json, os, pathlib, shutil, subprocess, tarfile, urllib.request

GOSU_URL = 'https://github.com/tianon/gosu/archive/refs/tags/1.20.tar.gz'
GOSU_SHA256 = '207a2045e890d3ca3326027c5f585733085960b401a49dbc00e3bb628c054cf8'
YAML_URL = 'https://registry.npmjs.org/js-yaml/-/js-yaml-3.15.2.tgz'
YAML_SHA512 = '6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w=='

def download(url):
    with urllib.request.urlopen(url, timeout=120) as response:
        return response.read()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=pathlib.Path)
    args = parser.parse_args()
    output = args.output.resolve()
    repo = pathlib.Path(__file__).resolve().parent.parent
    if output == repo or repo in output.parents:
        raise RuntimeError('Generated support contexts must stay outside the repository')
    output.mkdir(parents=True, exist_ok=True)
    go = os.environ.get('GO_EXECUTABLE', 'go')
    version = subprocess.check_output([go, 'version'], text=True).strip()
    if 'go1.27.4 ' not in version:
        raise RuntimeError('Use the reviewed Go 1.27.4 toolchain, not an implicit upgrade')
    source_bytes = download(GOSU_URL)
    if hashlib.sha256(source_bytes).hexdigest() != GOSU_SHA256:
        raise RuntimeError('gosu source integrity failure')
    source = output / 'gosu-source'
    source.mkdir(exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(source_bytes)) as archive:
        for member in archive.getmembers():
            name = pathlib.PurePosixPath(member.name)
            if member.isfile() and len(name.parts) == 2 and (name.suffix == '.go' or name.name in ['go.mod', 'go.sum', 'LICENSE']):
                (source / name.name).write_bytes(archive.extractfile(member).read())
    env = dict(os.environ, GOOS='linux', GOARCH='amd64', CGO_ENABLED='0', GOTOOLCHAIN='local')
    binary = output / 'gosu'
    subprocess.run([go, 'build', '-mod=readonly', '-trimpath', '-buildvcs=false', '-o', str(binary), '.'], cwd=source, env=env, check=True)
    build_metadata = subprocess.check_output([go, 'version', '-m', str(binary)], text=True)
    for component in ['postgres', 'mongo', 'redis']:
        target = output / component
        target.mkdir(exist_ok=True)
        shutil.copyfile(repo / 'deployment/support' / (component + '.Dockerfile'), target / 'Dockerfile')
        if component != 'redis':
            shutil.copyfile(binary, target / 'gosu')
    yaml_bytes = download(YAML_URL)
    if base64.b64encode(hashlib.sha512(yaml_bytes).digest()).decode() != YAML_SHA512:
        raise RuntimeError('js-yaml package integrity failure')
    with tarfile.open(fileobj=io.BytesIO(yaml_bytes)) as archive:
        for member in archive.getmembers():
            name = pathlib.PurePosixPath(member.name)
            if member.isfile() and name.parts[0] == 'package' and '..' not in name.parts:
                destination = output / 'mongo/js-yaml' / pathlib.Path(*name.parts[1:])
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(archive.extractfile(member).read())
    manifest = {'goVersion': version, 'architecture': 'linux/amd64', 'gosuVersion': '1.20',
                'gosuSourceURL': GOSU_URL, 'gosuSourceSHA256': GOSU_SHA256,
                'binarySHA256': hashlib.sha256(binary.read_bytes()).hexdigest(), 'buildMetadata': build_metadata,
                'yamlVersion': '3.15.2', 'yamlURL': YAML_URL, 'yamlIntegrity': 'sha512-' + YAML_SHA512}
    (output / 'build-metadata.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Prepared isolated support contexts with checksum-verified gosu source and pinned Go toolchain.')

if __name__ == '__main__':
    main()

"""Check every saved Docker image layer/config for known historical auth values.

Accepts Docker-save .tar/.tar.gz archives, never extracts them to the workspace.
Reports counts only, including matches in superseded layers. Does not establish
the absence of unknown secrets or audit external registries/deployments.
"""
import argparse, importlib.util, json
from pathlib import Path
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument('--image', required=True)
parser.add_argument('--archive', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('e2_boundaries', root/'scripts/verify-e2-artifacts.py')
boundaries = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundaries)
values = boundaries.candidates()
checked = 0
matches = 0
with tarfile.open(args.archive, 'r|*') as archive:
    for member in archive:
        if member.isfile():
            checked += 1
            with archive.extractfile(member) as stream:
                matches += boundaries.scan_stream(stream, values)
report = {'image': args.image, 'archiveMembersScanned': checked,
          'knownHistoricalValueMatches': matches, 'allSavedLayersAndConfigsChecked': True,
          'valuesReported': False}
if not args.image.replace('-', '').isalnum():
    raise RuntimeError('Use a simple non-sensitive image label')
(root/'docs/evidence/phase-e2'/f'image-boundary-{args.image}.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
if matches:
    raise RuntimeError('Known historical authentication value found; no value emitted')
print(f'{args.image}: {checked} archive members checked, zero known historical authentication values.')

"""Build a complete advisory occurrence register from preserved Trivy JSON reports."""
from pathlib import Path
import argparse, collections, csv, json

root = Path(__file__).resolve().parent.parent
evidence = root / 'docs/evidence/phase-e2'
parser = argparse.ArgumentParser()
parser.add_argument('--require-final', action='store_true')
args = parser.parse_args()
if args.require_final:
    built = json.loads((evidence/'final-image-metadata.json').read_text(encoding='utf-8-sig'))
    identities = []
    for component in ['server', 'gateway', 'web', 'postgres', 'mongo', 'redis']:
        image = next(item for item in built if 'noteora-'+component+':e2' in item.get('RepoTags', []))
        scan = json.loads((evidence/('rebuilt-'+component+'.json')).read_text(encoding='utf-8-sig'))
        if scan['Metadata']['ImageID'] != image['Id']:
            raise RuntimeError('Final scan/image identity mismatch: '+component)
        identities.append({'image': component, 'id': image['Id'], 'scanIdentityMatched': True})
    (evidence/'image-scan-identity-verification.json').write_text(json.dumps(identities, indent=2)+'\n', encoding='utf-8')
rows = []
summary = []
inherited = {}
base_packages = {}
for report in evidence.glob('base-*.json'):
    data = json.loads(report.read_text(encoding='utf-8-sig'))
    inherited[report.stem.removeprefix('base-')] = {
        (v['VulnerabilityID'], v['PkgName'])
        for result in data.get('Results', []) for v in result.get('Vulnerabilities', [])}
    base_packages[report.stem.removeprefix('base-')] = {
        p['Name']: p['Version'] for result in data.get('Results', [])
        if result.get('Class') == 'os-pkgs' for p in result.get('Packages', [])}
package_changes = []
for report in sorted(evidence.glob('base-*.json')) + sorted(evidence.glob('rebuilt-*.json')):
    data = json.loads(report.read_text(encoding='utf-8-sig'))
    if report.name.startswith('rebuilt-'):
        component = report.stem.removeprefix('rebuilt-')
        base = {'server': 'node', 'gateway': 'node'}.get(component, component)
        packages = {p['Name']: p['Version'] for result in data.get('Results', [])
                    if result.get('Class') == 'os-pkgs' for p in result.get('Packages', [])}
        previous = base_packages.get(base, {})
        for name in sorted(set(packages) | set(previous)):
            if packages.get(name) != previous.get(name):
                package_changes.append({'image': component, 'package': name,
                                        'before': previous.get(name, '(not installed)'),
                                        'after': packages.get(name, '(removed)')})
    findings = []
    for result in data.get('Results', []):
        for advisory in result.get('Vulnerabilities', []):
            row = {
                'scan': report.name, 'image': data.get('ArtifactName', ''),
                'target': result.get('Target', ''), 'type': result.get('Type', ''),
                'packagePath': advisory.get('PkgPath', ''),
                'id': advisory['VulnerabilityID'], 'package': advisory['PkgName'],
                'installed': advisory['InstalledVersion'],
                'fixed': advisory.get('FixedVersion', ''), 'severity': advisory['Severity'],
                'technicalImpact': advisory.get('Title', ''),
                'source': advisory.get('PrimaryURL', ''),
                'remediation': ('Rebuild with the listed fixed package version; verify compatibility and rescan'
                                if advisory.get('FixedVersion') else 'No scanner-listed fix; monitor vendor, restrict exposure and retain the risk'),
                'origin': 'Inherited base image' if report.name.startswith('base-') else 'Final image; compare base report by package and advisory',
            }
            if report.name.startswith('rebuilt-'):
                component = report.stem.removeprefix('rebuilt-')
                base = {'server': 'node', 'gateway': 'node'}.get(component, component)
                row['origin'] = ('Inherited advisory/package from pinned base'
                                 if (row['id'], row['package']) in inherited.get(base, set())
                                 else 'Added/changed runtime package; review package path')
            rows.append(row)
            findings.append(row)
    summary.append({'scan': report.name, 'image': data.get('ArtifactName'),
                    'occurrences': len(findings),
                    'uniqueAdvisoryIDs': len({r['id'] for r in findings}),
                    'metadata': data.get('Metadata', {}),
                    'severities': dict(collections.Counter(r['severity'] for r in findings))})
if rows:
    with (evidence / 'container-advisory-occurrences.csv').open('w', newline='', encoding='utf-8') as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
if package_changes:
    with (evidence / 'container-os-package-changes.csv').open('w', newline='', encoding='utf-8') as output:
        writer = csv.DictWriter(output, fieldnames=['image', 'package', 'before', 'after'])
        writer.writeheader()
        writer.writerows(package_changes)
(evidence / 'container-scan-summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
print(json.dumps([{k: v for k, v in item.items() if k != 'metadata'} for item in summary], indent=2))

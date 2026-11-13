"""Offline boundary checks. Credential values stay in memory and are never reported."""
from pathlib import Path
import argparse, fnmatch, gzip, hashlib, io, json, os, subprocess, tarfile

ROOT=Path(__file__).resolve().parent.parent
EVIDENCE=ROOT/'docs/evidence/phase-e2'

def candidates():
    manifest=json.loads((EVIDENCE/'export-storage-verification.json').read_text(encoding='utf-8-sig'))
    source=Path(manifest['archivePath'])
    values=set()
    def visit(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if any(word in key.lower() for word in ['password','token','secret','apikey','apisecret']) and isinstance(item,str) and len(item)>=16:
                    values.add(item.encode())
                visit(item)
        elif isinstance(value,list):
            for item in value:visit(item)
    for file in source.glob('*.json'):visit(json.loads(file.read_text(encoding='utf-8-sig')))
    return values

def scan_stream(stream,values):
    found=set();tail=b'';overlap=max((len(v) for v in values),default=1)-1
    while True:
        data=stream.read(1024*1024)
        if not data:break
        data=tail+data
        found.update(i for i,v in enumerate(values) if v in data)
        tail=data[-overlap:] if overlap else b''
    return len(found)

def permitted(file):
    rel=file.relative_to(ROOT);parts=rel.parts
    if any(part in ['node_modules','dist','.git','.dev-mail','uploads','backups','secrets','.aws','.azure'] for part in parts):return False
    name=file.name
    if name.startswith('.env') and name!='.env.example':return False
    if name in ['.npmrc','.pypirc'] or name.startswith(('id_rsa','id_ed25519')):return False
    if any(fnmatch.fnmatch(name,pattern) for pattern in ['*.pem','*.key','*.p12','*.pfx','*.log']):return False
    return True

def source_context(output,values):
    selected=[]
    for directory in ['server/src','client','gateway-api/src','database/prisma','security']:
        selected.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and permitted(p))
    for directory in ['','server','gateway-api']:
        selected.extend(p for p in (ROOT/directory).glob('package*.json') if p.is_file())
    for name in ['.dockerignore','server/Dockerfile','gateway-api/Dockerfile','server/tsconfig.json','gateway-api/tsconfig.json']:
        selected.append(ROOT/name)
    selected=sorted(set(selected))
    assert not any('database/export' in p.as_posix() for p in selected)
    hits=[]
    for file in selected:
        with file.open('rb') as f:
            if scan_stream(f,values):hits.append(str(file.relative_to(ROOT)))
    if hits:raise RuntimeError('Sensitive content found in context; see private owner review. No values emitted.')
    output.parent.mkdir(parents=True,exist_ok=True)
    with tarfile.open(output,'w:gz') as archive:
        for file in selected:archive.add(file,arcname=file.relative_to(ROOT).as_posix(),recursive=False)
    return {'fileCount':len(selected),'historicalValueMatches':0,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'selection':'Explicit application-source allowlist; no private exports, environment files, installed dependencies or outputs'}

def verify_outputs(values):
    results=[]
    for directory in ['client/dist','server/dist','gateway-api/dist','docs/evidence/phase-e2']:
        files=[p for p in (ROOT/directory).rglob('*') if p.is_file()]
        hits=[]
        for file in files:
            with file.open('rb') as f:
                if scan_stream(f,values):hits.append(str(file.relative_to(ROOT)))
        results.append({'directory':directory,'filesScanned':len(files),'historicalValueMatchFiles':hits})
    return results

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--context',type=Path);args=parser.parse_args()
    values=candidates()
    report={'historicalCandidateCount':len(values),'outputs':verify_outputs(values),'gitExportPaths':subprocess.run(['git','ls-files','database/export'],cwd=ROOT,text=True,capture_output=True,check=True).stdout.splitlines(),'rawCredentialValuesReported':False}
    if args.context:report['sanitizedBuildContext']=source_context(args.context,values)
    assert not report['gitExportPaths']
    assert all(not row['historicalValueMatchFiles'] for row in report['outputs'])
    (EVIDENCE/'repository-artifact-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('Offline checks passed: no historical authentication values in application outputs or selected build context; no exports tracked.')

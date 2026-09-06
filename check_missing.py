import os, sys

results = {}
for root, dirs, files in os.walk('src'):
    dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist')]
    for f in files:
        if not f.endswith('.ts'):
            continue
        fpath = os.path.join(root, f)
        try:
            content = open(fpath, 'utf-8').read()
        except:
            continue
        # Find imports
        import re
        matches = re.findall(r"from ['\"]([^'\"]+)['\"]", content)
        for pkg in matches:
            if pkg.startswith('.') or pkg.startswith('@/') or pkg.startswith('~/') or 'prisma' in pkg or pkg == 'express':
                continue
            if pkg not in results:
                results[pkg] = []
            results[pkg].append(fpath)

# Check which packages can't be resolved
import subprocess
for pkg in sorted(results.keys()):
    try:
        subprocess.run(['node', '-e', f'require.resolve("{pkg}")'], cwd=os.getcwd(), capture_output=True, timeout=5)
    except subprocess.TimeoutExpired:
        pass
    except:
        print(f"MISSING: {pkg} ({len(results[pkg])} files: {', '.join(results[pkg][:3])})")

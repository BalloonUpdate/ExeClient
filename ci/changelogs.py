import sys
import subprocess
import time

if len(sys.argv) <2:
    print('output filename is required!')
    sys.exit(1)

output = sys.argv[1]

def execute(cmd):
    return subprocess.check_output(cmd, encoding='utf-8')

excludes = []
tags = execute('git tag --sort=creatordate').strip().split('\n')
buf = ''

print(tags)

tags.reverse()
for tag in tags:
    comment = execute('git show refs/tags/'+tag+' -s --format=%B').strip()
    ts = int(execute('git show refs/tags/'+tag+' -s --format=%ct').strip().split('\n')[-1])

    dt = time.strftime('%Y-%m-%d', time.gmtime(ts))
    buf += tag+':     ('+dt+')\n    '+comment.replace('\n', '\n    ')+'\n\n'

with open(output, "w+", encoding="utf-8") as f:
    f.write(buf)
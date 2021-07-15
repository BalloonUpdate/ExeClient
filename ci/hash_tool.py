import sys
import hashlib

if len(sys.argv) < 2:
    print('file to be hashed is required!')
    sys.exit(1)

file = sys.argv[1]

def hash(fileToBeHashed, hashobj):
    with open(fileToBeHashed, 'rb') as f:
        hashobj.update(f.read())
        return hashobj.hexdigest()

def show_hash(f, hashobj):
    print(hashobj.name+': '+hash(f, hashobj))

print('hashes for '+file)
show_hash(file, hashlib.md5())
show_hash(file, hashlib.sha1())
show_hash(file, hashlib.sha256())
#!/usr/bin/env python3
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys


PLACEHOLDER = 'agenthub-eval-recorder-placeholder'
CHILD_CODE = r'''
import errno
import json
import os
from pathlib import Path
import sys
import tempfile

request = json.load(sys.stdin)
result = {'uid': os.getuid(), 'euid': os.geteuid(), 'gid': os.getgid(),
          'egid': os.getegid(), 'supplementaryGroups': os.getgroups(),
          'apiKeyIsPlaceholder': os.environ.get('OPENAI_API_KEY') == request['placeholder'],
          'environmentIsExactAllowlist': sorted(os.environ) == sorted(request['environmentNames']),
          'parentUid': Path('/proc/' + str(request['parentPid']) + '/status').read_text().split('Uid:')[1].splitlines()[0].strip(),
          'procChecks': {}, 'writes': []}
for name in ('environ', 'mem'):
    try:
        with open('/proc/' + str(request['parentPid']) + '/' + name, 'rb') as stream:
            if name == 'environ':
                stream.read(1)
        result['procChecks'][name] = {'denied': False}
    except OSError as error:
        result['procChecks'][name] = {'denied': error.errno in (errno.EACCES, errno.EPERM),
                                     'errno': error.errno, 'errorType': type(error).__name__}
for directory in request['writeDirs']:
    name = None
    try:
        descriptor, name = tempfile.mkstemp(prefix='.agenthub-isolation-probe-', dir=directory)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(b'agenthub-fake-key-isolation-probe\n')
        path = Path(name)
        result['writes'].append({'directory': directory, 'written': path.read_bytes() == b'agenthub-fake-key-isolation-probe\n',
                                 'ownerUid': path.stat().st_uid})
    except OSError as error:
        result['writes'].append({'directory': directory, 'written': False,
                                 'errno': error.errno, 'errorType': type(error).__name__})
    finally:
        if name is not None:
            Path(name).unlink()
print(json.dumps(result))
'''


def main():
    parser = argparse.ArgumentParser(description='No-model Linux actor privilege and write-permission probe')
    parser.add_argument('--uid', type=int, default=501)
    parser.add_argument('--gid', type=int, default=20)
    parser.add_argument('--write-dir', action='append', choices=('/state', '/workspace'))
    arguments = parser.parse_args()
    report = {'schemaVersion': 'agenthub_isolation_probe_v1', 'modelCalls': 0,
              'status': 'failed', 'platform': sys.platform}
    if sys.platform != 'linux' or not hasattr(os, 'geteuid') or os.geteuid() != 0:
        report.update(status='unsupported', reason='Run inside the Linux task image as root')
        print(json.dumps(report))
        return 2
    if not 0 < arguments.uid < 2**31 or not 0 < arguments.gid < 2**31:
        parser.error('Probe actor UID and GID must be positive unprivileged IDs')
    if any(os.environ.get(name) for name in ('OPENAI_API_KEY', 'JUDGE_API_KEY', 'ACTOR_API_KEY', 'DEEPSEEK_API_KEY')):
        report['reason'] = 'Do not supply provider credentials to this fake-key probe'
        print(json.dumps(report))
        return 2
    directories = arguments.write_dir or ['/state']
    if any(not Path(directory).is_dir() for directory in directories):
        report['reason'] = 'Every selected write directory must already exist'
        print(json.dumps(report))
        return 2
    fake_key = 'agenthub-probe-only-' + secrets.token_hex(32)
    root_environ = Path('/proc/self/environ').read_bytes()
    if not root_environ:
        raise RuntimeError('Supervisor environment must be readable before testing child denial')
    environment = {'PATH': os.environ['PATH'], 'HOME': '/state/home', 'LANG': 'C.UTF-8',
                   'OPENAI_API_KEY': PLACEHOLDER, 'OPENAI_BASE_URL': 'http://127.0.0.1:4002/v1',
                   'NO_PROXY': '127.0.0.1,localhost,::1', 'NODE_USE_ENV_PROXY': '1'}
    child_input = {'parentPid': os.getpid(), 'placeholder': PLACEHOLDER,
                   'environmentNames': list(environment), 'writeDirs': directories}
    completed = subprocess.run([sys.executable, '-I', '-S', '-c', CHILD_CODE],
        input=json.dumps(child_input), capture_output=True, text=True, timeout=10,
        env=environment, user=arguments.uid, group=arguments.gid, extra_groups=[])
    report.update(supervisorUid=os.geteuid(), fakeKeyOnlyInSupervisorMemory=fake_key not in os.environ.values(),
                  childExitCode=completed.returncode)
    if completed.returncode != 0:
        report['reason'] = 'Unprivileged probe failed before completing its checks'
        report['childStderr'] = completed.stderr[:2000]
        print(json.dumps(report))
        return 1
    child = json.loads(completed.stdout)
    identity_ok = (child['uid'] == child['euid'] == arguments.uid
                   and child['gid'] == child['egid'] == arguments.gid
                   and child['supplementaryGroups'] == [])
    proc_denied = all(child['procChecks'][name]['denied'] for name in ('environ', 'mem'))
    writes_ok = all(item['written'] and item['ownerUid'] == arguments.uid for item in child['writes'])
    passed = (identity_ok and proc_denied and writes_ok and child['apiKeyIsPlaceholder']
              and child['environmentIsExactAllowlist'] and report['fakeKeyOnlyInSupervisorMemory'])
    report.update(status='passed' if passed else 'failed', child=child)
    print(json.dumps(report))
    return 0 if passed else 1


if __name__ == '__main__':
    sys.exit(main())

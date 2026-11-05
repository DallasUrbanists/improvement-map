import test from 'node:test';
import assert from 'node:assert/strict';
import { release } from '../scripts/release.js';

test('release rejects missing, unsupported, and extra arguments before running commands', () => {
  for (const args of [[], ['prerelease'], ['patch', '--force']]) {
    assert.equal(release(args, { run() { assert.fail('Invalid input must not execute commands'); } }), 2);
  }
});

test('release checks main before versioning and pushes only after success', () => {
  for (const increment of ['major', 'minor', 'patch']) {
    const calls = [];
    assert.equal(release([increment], {
      npmCli: '/fixture/npm-cli.js',
      run(command, args) { calls.push([command, args]); return { status: 0 }; },
    }), 0);
    assert.equal(calls.length, 3);
    assert.equal(calls[0][0], process.execPath);
    assert.match(calls[0][1][0], /assert-main\.js$/);
    assert.deepEqual(calls[1], [process.execPath, ['/fixture/npm-cli.js', 'version', increment]]);
    assert.deepEqual(calls[2], ['git', ['push', 'origin', 'main', '--tags']]);
  }
});

test('release stops on guard, version, or push failure without continuing', () => {
  for (const failureAt of [0, 1, 2]) {
    let calls = 0;
    const result = release(['patch'], {
      run() { return { status: calls++ === failureAt ? 7 : 0 }; },
    });
    assert.equal(result, 7);
    assert.equal(calls, failureAt + 1);
  }
});

test('release stops if a command cannot start or is terminated', () => {
  for (const failure of [{ error: new Error('Command unavailable'), status: null }, { status: null, signal: 'SIGTERM' }]) {
    let calls = 0;
    assert.equal(release(['patch'], { run() { calls++; return failure; } }), 1);
    assert.equal(calls, 1);
  }
});

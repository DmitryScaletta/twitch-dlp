import assert from 'node:assert';
import { describe, it } from 'node:test';
import { parseDownloadSectionsArg } from './parseDownloadSectionsArg.ts';

describe('parseDownloadSectionsArg', () => {
  it('return null for empty arg', () => {
    assert.equal(parseDownloadSectionsArg(), null);
    assert.equal(parseDownloadSectionsArg(''), null);
  });

  it('should parse --download-sections arg', () => {
    const cases = [
      ['*0-inf', { startTime: 0, endTime: Infinity }],
      ['*5-10', { startTime: 5, endTime: 10 }],
      ['*3:14:15-inf', { startTime: 11655, endTime: Infinity }],
      ['*13:14:15-16:17:18', { startTime: 47655, endTime: 58638 }],
    ] as const;
    for (const [arg, expected] of cases) {
      assert.deepStrictEqual(parseDownloadSectionsArg(arg), expected);
    }
  });

  it('should throw error for wrong syntax', () => {
    const cases = [
      '*13:14:15-13:14:15inf',
      '*13:14:15-inf13:14:15',
      '*10-5',
      '*10-10',
      '*60-inf',
      '*61:00-inf',
      '*99:00:00-inf',
    ] as const;
    for (const arg of cases) {
      assert.throws(() => parseDownloadSectionsArg(arg));
    }
  });
});

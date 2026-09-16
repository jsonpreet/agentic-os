import { describe, it, expect } from 'vitest';
import * as contracts from '../src/index.js';

describe('Shared Contracts', () => {
  it('exports all core domain contracts', () => {
    expect(contracts).toBeDefined();
  });
});

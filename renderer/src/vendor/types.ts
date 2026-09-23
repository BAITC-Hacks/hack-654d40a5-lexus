/**
 * Minimal BgSpec extracted from anything2explainer's common/types.ts.
 * Copyright (c) 2026 Vincent Wei. See ../../ANYTHING2EXPLAINER-LICENSE.
 * Unused shot and star-renderer dependencies were removed for this adapter.
 */
export type BgSpec = {
  from: number;
  to: number;
  stars?: 'drift' | 'fast' | 'still' | 'none';
  fog?: boolean;
};

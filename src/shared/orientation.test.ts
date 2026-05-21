import { describe, expect, it } from 'vitest';
import {
  getDefaultOrientation,
  getYaw,
  isDefaultOrientation,
  isFileOrientation,
  isYaw,
  orientationEquals,
  rotateYaw
} from './orientation';

describe('orientation: yaw helpers', () => {
  it('isYaw accepts 15-degree multiples in [0, 360)', () => {
    expect(isYaw(0)).toBe(true);
    expect(isYaw(15)).toBe(true);
    expect(isYaw(90)).toBe(true);
    expect(isYaw(180)).toBe(true);
    expect(isYaw(270)).toBe(true);
    expect(isYaw(345)).toBe(true);
  });

  it('isYaw rejects off-grid, out-of-range, or non-number values', () => {
    expect(isYaw(7)).toBe(false);
    expect(isYaw(91)).toBe(false);
    expect(isYaw(-15)).toBe(false);
    expect(isYaw(360)).toBe(false);
    expect(isYaw(15.5)).toBe(false);
    expect(isYaw('15')).toBe(false);
    expect(isYaw(NaN)).toBe(false);
  });

  it('rotateYaw wraps and snaps to the 15° grid', () => {
    expect(rotateYaw(0, 15)).toBe(15);
    expect(rotateYaw(345, 15)).toBe(0);
    expect(rotateYaw(0, -15)).toBe(345);
    expect(rotateYaw(0, 90)).toBe(90);
    expect(rotateYaw(0, -90)).toBe(270);
    expect(rotateYaw(0, 360)).toBe(0);
    // Snapping defends against off-grid input.
    expect(rotateYaw(0, 17)).toBe(15);
    expect(rotateYaw(0, 23)).toBe(30);
  });

  it('getYaw defaults to 0 when yaw is absent', () => {
    expect(getYaw({ upAxis: '+Y' })).toBe(0);
    expect(getYaw({ upAxis: '+Z', yaw: 270 })).toBe(270);
    expect(getYaw({ upAxis: '+Z', yaw: 15 })).toBe(15);
  });
});

describe('orientation: validators and equality', () => {
  it('isFileOrientation accepts rows with and without yaw', () => {
    expect(isFileOrientation({ upAxis: '+Z' })).toBe(true);
    expect(isFileOrientation({ upAxis: '+Z', yaw: 90 })).toBe(true);
    expect(isFileOrientation({ upAxis: '+Z', yaw: 15 })).toBe(true);
    expect(isFileOrientation({ upAxis: '+Z', yaw: 7 })).toBe(false);
    expect(isFileOrientation({ upAxis: 'up' })).toBe(false);
    expect(isFileOrientation(null)).toBe(false);
  });

  it('orientationEquals treats missing yaw as 0', () => {
    expect(orientationEquals({ upAxis: '+Y' }, { upAxis: '+Y', yaw: 0 })).toBe(true);
    expect(orientationEquals({ upAxis: '+Y', yaw: 90 }, { upAxis: '+Y' })).toBe(false);
    expect(orientationEquals({ upAxis: '+Z' }, { upAxis: '+Y' })).toBe(false);
  });

  it('isDefaultOrientation flags format-default values for normalization', () => {
    // STL default is +Z, yaw 0
    expect(isDefaultOrientation({ upAxis: '+Z' }, 'stl')).toBe(true);
    expect(isDefaultOrientation({ upAxis: '+Z', yaw: 0 }, 'stl')).toBe(true);
    expect(isDefaultOrientation({ upAxis: '+Z', yaw: 90 }, 'stl')).toBe(false);
    expect(isDefaultOrientation({ upAxis: '+Y' }, 'stl')).toBe(false);
    // GLB default is +Y, yaw 0
    expect(isDefaultOrientation({ upAxis: '+Y' }, 'glb')).toBe(true);
  });

  it('getDefaultOrientation per format (regression of Phase 5b defaults)', () => {
    expect(getDefaultOrientation('stl').upAxis).toBe('+Z');
    expect(getDefaultOrientation('3mf').upAxis).toBe('+Z');
    expect(getDefaultOrientation('glb').upAxis).toBe('+Y');
  });
});

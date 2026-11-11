import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { computeFaceSlope } from '../src/mesh/lowpoly';

describe('Slope Calculation', () => {
  it('computes 0° for horizontal face (normal pointing straight up)', () => {
    const normal = new THREE.Vector3(0, 1, 0);
    const slope = computeFaceSlope(normal);
    expect(slope).toBeCloseTo(0, 2);
  });

  it('computes 90° for vertical face', () => {
    const normal = new THREE.Vector3(1, 0, 0);
    const slope = computeFaceSlope(normal);
    expect(slope).toBeCloseTo(90, 2);
  });

  it('computes ~45° for 45-degree slope', () => {
    const normal = new THREE.Vector3(1, 1, 0).normalize();
    const slope = computeFaceSlope(normal);
    expect(slope).toBeCloseTo(45, 1);
  });
});


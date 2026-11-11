import { describe, it, expect } from 'vitest';
import { loadASC } from '../src/loaders/asc-loader';
import { loadCSV } from '../src/loaders/csv-loader';
import { loadJSON } from '../src/loaders/json-loader';

describe('Loaders', () => {
  it('parses ESRI ASCII grid text', async () => {
    const ascContent = `ncols 3
nrows 3
xllcorner 0
yllcorner 0
cellsize 1
NODATA_value -9999
10 20 30
40 50 60
70 80 90`;

    const file = new File([ascContent], 'test.asc', { type: 'text/plain' });
    const result = await loadASC(file);

    expect(result.width).toBe(3);
    expect(result.height).toBe(3);
    expect(result.data.length).toBe(9);
    // Min is 10 (normalized 0), max is 90 (normalized 1)
    expect(result.data[0]).toBeCloseTo(0, 3);
    expect(result.data[8]).toBeCloseTo(1, 3);
  });

  it('parses CSV with x,y,z headers', async () => {
    const csvContent = `x,y,z
0,0,10
1,0,20
0,1,30
1,1,40`;

    const file = new File([csvContent], 'points.csv', { type: 'text/csv' });
    const result = await loadCSV(file, 4);

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.data.length).toBe(16);
  });

  it('parses JSON point array', async () => {
    const jsonContent = JSON.stringify([
      { lat: 10, lon: 20, elevation: 100 },
      { lat: 11, lon: 20, elevation: 200 },
      { lat: 10, lon: 21, elevation: 150 },
      { lat: 11, lon: 21, elevation: 300 },
    ]);

    const file = new File([jsonContent], 'points.json', { type: 'application/json' });
    const result = await loadJSON(file, 4);

    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.data.length).toBe(16);
  });

  it('throws on empty CSV', async () => {
    const file = new File(['header\n'], 'empty.csv', { type: 'text/csv' });
    await expect(loadCSV(file, 4)).rejects.toThrow();
  });

  it('throws on invalid JSON', async () => {
    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    await expect(loadJSON(file, 4)).rejects.toThrow();
  });
});


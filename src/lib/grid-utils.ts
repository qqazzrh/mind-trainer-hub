// Grid pattern generation for The Grid game.

export type GridLevel = 1 | 2 | 3 | 4;

export const LEVEL_SPECS: Record<GridLevel, {
  size: number;
  viewingTime: number;
  colors: number;
  density: [number, number];
  label: string;
}> = {
  1: { size: 3, viewingTime: 10, colors: 1, density: [0.3, 0.4], label: "Level 1 (Easy)" },
  2: { size: 4, viewingTime: 8, colors: 2, density: [0.4, 0.55], label: "Level 2 (Medium)" },
  3: { size: 5, viewingTime: 6, colors: 3, density: [0.5, 0.65], label: "Level 3 (Hard)" },
  4: { size: 6, viewingTime: 5, colors: 3, density: [0.55, 0.7], label: "Level 4 (Adaptive Max)" },
};

export function sectionLayout(playerCount: number) {
  if (playerCount === 2) return { cols: 2, rows: 1, labels: ["L", "R"] };
  if (playerCount === 3) return { cols: 3, rows: 1, labels: ["L", "C", "R"] };
  return { cols: 2, rows: 2, labels: ["TL", "TR", "BL", "BR"] };
}

// 0=empty, 1=color A, 2=color B, 3=color C
export type Section = number[][]; // [row][col] cells

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function generateSection(level: GridLevel): Section {
  const { size, colors, density } = LEVEL_SPECS[level];
  while (true) {
    const target = rand(density[0], density[1]);
    const cells: Section = [];
    for (let r = 0; r < size; r++) {
      const row: number[] = [];
      for (let c = 0; c < size; c++) {
        if (Math.random() < target) {
          row.push(1 + Math.floor(Math.random() * colors));
        } else {
          row.push(0);
        }
      }
      cells.push(row);
    }
    // No section may be entirely empty or filled
    const total = size * size;
    const filled = cells.flat().filter((v) => v > 0).length;
    if (filled > 0 && filled < total) return cells;
  }
}

export function generateGrid(level: GridLevel, playerCount: number): Section[] {
  return Array.from({ length: playerCount }, () => generateSection(level));
}

export function totalCells(level: GridLevel, playerCount: number) {
  return LEVEL_SPECS[level].size * LEVEL_SPECS[level].size * playerCount;
}

// Adaptive engine: given last-2-rounds avg percentage, recommend next level.
export function recommendLevel(currentLevel: GridLevel, avgPct: number): GridLevel {
  if (avgPct >= 0.85 && currentLevel < 4) return (currentLevel + 1) as GridLevel;
  if (avgPct < 0.6 && currentLevel > 1) return (currentLevel - 1) as GridLevel;
  return currentLevel;
}
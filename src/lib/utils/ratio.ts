const greatestCommonDivisor = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
};

export const simplifyRatio = (weights: number[]): number[] => {
  if (weights.length === 0) {
    return [];
  }

  const rounded = weights.map((weight) => Math.round(weight));
  const divisor = rounded.reduce((accumulator, weight) => greatestCommonDivisor(accumulator, weight), rounded[0]);

  return rounded.map((weight) => weight / divisor);
};

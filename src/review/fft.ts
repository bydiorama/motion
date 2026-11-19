// A small radix-2 FFT, in place, for the review's phase correlation. Sizes are
// powers of two. Real and imaginary parts live in separate arrays.

/** One transform of length re.length (a power of two); `inverse` scales by 1/n. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error(`fft: length ${n} is not a power of two`);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!; re[i] = re[j]!; re[j] = t;
      t = im[i]!; im[i] = im[j]!; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci, xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi;
        re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] = re[i]! / n; im[i] = im[i]! / n; }
}

/** A 2D transform of an n × n grid stored row by row. */
export function fft2(re: Float64Array, im: Float64Array, n: number, inverse = false): void {
  const r = new Float64Array(n), i = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    const o = y * n;
    for (let x = 0; x < n; x++) { r[x] = re[o + x]!; i[x] = im[o + x]!; }
    fft(r, i, inverse);
    for (let x = 0; x < n; x++) { re[o + x] = r[x]!; im[o + x] = i[x]!; }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { r[y] = re[y * n + x]!; i[y] = im[y * n + x]!; }
    fft(r, i, inverse);
    for (let y = 0; y < n; y++) { re[y * n + x] = r[y]!; im[y * n + x] = i[y]!; }
  }
}

const ECC_CODEWORDS = [7, 10, 15, 20, 26];
const DATA_CODEWORDS = [19, 34, 55, 80, 108];

function multiply(x, y) {
  let product = 0;
  for (let i = 7; i >= 0; i--) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    product ^= ((y >>> i) & 1) * x;
  }
  return product;
}

function divisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
}

function remainder(data, degree) {
  const poly = divisor(degree);
  const result = new Uint8Array(degree);
  for (const value of data) {
    const factor = value ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let i = 0; i < degree; i++) result[i] ^= multiply(poly[i], factor);
  }
  return result;
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function codewords(text) {
  const bytes = new TextEncoder().encode(text);
  const versionIndex = DATA_CODEWORDS.findIndex(count => bytes.length <= Math.floor((count * 8 - 12) / 8));
  if (versionIndex < 0) throw new Error('This viewing link is too long to encode as a QR code.');
  const version = versionIndex + 1;
  const capacity = DATA_CODEWORDS[versionIndex];
  const bits = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);
  const maxBits = capacity * 8;
  for (let i = 0; i < Math.min(4, maxBits - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);
  return { version, data: Uint8Array.from(data), ecc: remainder(Uint8Array.from(data), ECC_CODEWORDS[versionIndex]) };
}

function qrMatrix(text) {
  const { version, data, ecc } = codewords(text);
  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) matrix[y][x] = Boolean(dark); };
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, distance !== 2 && distance !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) set(i, 6, i % 2 === 0);
    if (matrix[i][6] === null) set(6, i, i % 2 === 0);
  }
  if (version > 1) {
    const centers = [6, size - 7];
    for (const centerY of centers) for (const centerX of centers) {
      if (centerX === 6 && centerY === 6) continue;
      const center = { x: centerX, y: centerY };
      const { x: cx, y: cy } = center;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, distance !== 1);
      }
    }
  }
  // Format information for error correction level L, mask pattern 0.
  const formatData = 0b01000;
  let remainderBits = formatData;
  for (let i = 0; i < 10; i++) remainderBits = (remainderBits << 1) ^ (((remainderBits >>> 9) & 1) * 0x537);
  const format = ((formatData << 10) | remainderBits) ^ 0x5412;
  const bit = i => ((format >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);

  const stream = [...data, ...ecc].flatMap(value => Array.from({ length: 8 }, (_, i) => (value >>> (7 - i)) & 1));
  let index = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (matrix[y][x] !== null) continue;
        const value = index < stream.length ? stream[index++] === 1 : false;
        set(x, y, value !== ((x + y) % 2 === 0));
      }
    }
    upward = !upward;
  }
  return matrix;
}

export function presentationQrSvg(value, { quietZone = 4 } = {}) {
  const matrix = qrMatrix(String(value));
  const size = matrix.length;
  const parts = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) parts.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`); }));
  const edge = size + quietZone * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${edge} ${edge}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${parts.join('')}" fill="#111"/></svg>`;
}

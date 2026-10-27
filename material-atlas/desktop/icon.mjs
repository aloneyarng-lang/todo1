import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function makeIcon() {
  const sizes = [16, 32, 48, 256], images = [];
  for (const size of sizes) {
    const pixels = Buffer.alloc(size * size * 4), mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x + .5) / size - .5, v = (y + .5) / size - .5;
      const outsideCorner = Math.abs(u) > .31 && Math.abs(v) > .31 && Math.hypot(Math.abs(u) - .31, Math.abs(v) - .31) > .19;
      let color = [37, 83, 77, outsideCorner ? 0 : 255];
      for (const angle of [-Math.PI / 4, Math.PI / 4]) {
        const a = u * Math.cos(angle) - v * Math.sin(angle), b = u * Math.sin(angle) + v * Math.cos(angle);
        const r = Math.sqrt((a / .38) ** 2 + (b / .17) ** 2);
        if (Math.abs(r - 1) < Math.max(.025, 1 / size * 2.2)) color = [227, 234, 215, 255];
      }
      if (Math.hypot(u, v) < .065 || Math.hypot(u - .275, v + .275) < .047) color = [218, 187, 125, 255];
      const i = ((size - y - 1) * size + x) * 4;
      pixels[i] = color[2]; pixels[i + 1] = color[1]; pixels[i + 2] = color[0]; pixels[i + 3] = color[3];
    }
    const header = Buffer.alloc(40); header.writeUInt32LE(40, 0); header.writeInt32LE(size, 4); header.writeInt32LE(size * 2, 8); header.writeUInt16LE(1, 12); header.writeUInt16LE(32, 14); header.writeUInt32LE(pixels.length, 20);
    images.push(Buffer.concat([header, pixels, mask]));
  }
  const directory = Buffer.alloc(6 + sizes.length * 16); directory.writeUInt16LE(1, 2); directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, i) => { const base = 6 + i * 16; directory[base] = size === 256 ? 0 : size; directory[base + 1] = size === 256 ? 0 : size; directory.writeUInt16LE(1, base + 4); directory.writeUInt16LE(32, base + 6); directory.writeUInt32LE(images[i].length, base + 8); directory.writeUInt32LE(offset, base + 12); offset += images[i].length; });
  const target = path.join(path.dirname(fileURLToPath(import.meta.url)), 'materia.ico');
  await writeFile(target, Buffer.concat([directory, ...images])); return target;
}

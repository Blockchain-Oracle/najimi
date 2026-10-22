// The home-screen icons (W24), drawn once from one SVG: the aura orb on black with Najimi's ring.
//   node scripts/app-icons.mjs   → public/icons/*.png and app/apple-icon.png
import { mkdir, writeFile } from "node:fs/promises"
import sharp from "sharp"

const art = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="a" cx="30%" cy="28%" r="80%">
      <stop offset="0" stop-color="#FFB23E"/>
      <stop offset="0.45" stop-color="#FF4FA3"/>
      <stop offset="1" stop-color="#8B5CFF"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#000"/>
  <circle cx="256" cy="256" r="${190 - pad}" fill="url(#a)"/>
  <circle cx="256" cy="256" r="${104 - pad / 2}" fill="none" stroke="#fff" stroke-width="${34 - pad / 6}"/>
</svg>`

await mkdir("public/icons", { recursive: true })
const out = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  // Maskable: the mark inside the safe zone (Android crops to a circle or squircle).
  ["public/icons/maskable-512.png", 512, 48],
  ["app/apple-icon.png", 180, 0],
]
for (const [file, size, pad] of out) {
  const png = await sharp(Buffer.from(art(pad)))
    .resize(size, size)
    .png()
    .toBuffer()
  await writeFile(file, png)
  console.log(file, size)
}

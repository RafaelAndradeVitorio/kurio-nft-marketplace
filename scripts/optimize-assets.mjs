import sharp from "sharp";
for (const id of ["8f387", "83794", "9add2", "b7cfc"]) {
  await sharp(`public/assets/${id}.png`)
    .resize(900, 900, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(`public/assets/${id}.webp`);
}

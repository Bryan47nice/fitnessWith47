import { readFileSync, mkdirSync } from 'fs';
import sharp from 'sharp';

const svgBuffer = readFileSync('public/logo.svg');
mkdirSync('public/icons', { recursive: true });

await sharp(svgBuffer).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(svgBuffer).resize(512, 512).png().toFile('public/icons/icon-512.png');
console.log('Icons generated: public/icons/icon-192.png & icon-512.png');

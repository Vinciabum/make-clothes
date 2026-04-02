import fs from 'fs';
import path from 'path';

const artifactDir = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\b0502c8e-6aa4-464b-8cff-6aafe8f412d0';
const targetDir = 'c:\\Users\\user\\Desktop\\make_clothes\\public\\thumbnails';

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const presetsPath = 'c:\\Users\\user\\Desktop\\make_clothes\\public\\presets.json';
let presetsData = fs.readFileSync(presetsPath, 'utf8');

const ids = [
  'male_suit', 'male_grey_suit', 'casual_smart_m', 'female_suit', 'female_blazer_navy', 'female_blouse_cream', 'casual_smart_f', 
  'neat_short', 'side_part', 'sleek_updo', 'medium_soft_shag', 'medium_c_curl', 'long_straight', 'wavy_long', 'curly_bob', 'bun', 'color_dark'
];

for (const id of ids) {
    const files = fs.readdirSync(artifactDir)
        .filter(f => f.startsWith(`${id}_`) && f.endsWith('.png'));
    
    if (files.length > 0) {
        files.sort();
        const latestFile = files[files.length - 1];
        
        const srcPath = path.join(artifactDir, latestFile);
        const destPath = path.join(targetDir, `${id}.png`);
        
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${latestFile} to ${id}.png`);
        
        // Update presets.json replacing .jpg with .png
        presetsData = presetsData.replace(new RegExp(`"thumbnailUrl"\\s*:\\s*"/thumbnails/${id}\\.(jpg|png|webp)"`, 'g'), `"thumbnailUrl": "/thumbnails/${id}.png"`);
    } else {
        console.warn(`No thumbnail found for ${id}`);
    }
}

fs.writeFileSync(presetsPath, presetsData);
console.log("Updated presets.json");

import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Logger } from '.nuxt/imports.js';

const execPromise = promisify(exec);

const EXTENSIONS: string[] = ['.png', '.jpg', '.jpeg'];
const QUALITY: number = 100;

const log = new Logger('webp');

/**
 * Get all images in the directory with the specified extensions.
 */
async function getImages(directory: string): Promise<string[]> {
  try {
    // Debug: Print the current directory
    log.info(`Scanning directory: ${directory}`);

    const allFiles = await fs.promises.readdir(directory);
    log.info(`All files in directory: ${allFiles.join(', ')}`);

    const images = allFiles.filter(file =>
      EXTENSIONS.includes(path.extname(file).toLowerCase())
    ).map(file => path.join(directory, file));

    log.info(`Found images: ${images.map(img => path.basename(img)).join(', ')}`);
    return images;
  } catch (e) {
    log.error('Error getting images: %s', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Check if a command exists in the system
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    const platform = process.platform;
    const cmd = platform === 'win32' ? 'where' : 'which';
    await execPromise(`${cmd} ${command}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert an image to WebP format using cwebp.
 */
async function convertToWebp(imagePath: string): Promise<void> {
  try {
    const outputFile = path.join(
      path.dirname(imagePath),
      `${path.basename(imagePath, path.extname(imagePath))}.webp`
    );

    const cwebpExists = await commandExists('cwebp');
    if (!cwebpExists) {
      log.error('cwebp is not installed, visit: https://github.com/Yukioru/cwebp-cli');
      return;
    }

    const command = `cwebp -q ${QUALITY} "${imagePath}" -o "${outputFile}"`;
    const { stderr } = await execPromise(command);

    if (stderr && stderr.trim() !== '') {
      log.error(`Error converting ${path.basename(imagePath)}: ${stderr.trim()}`);
    } else {
      log.info(`Converted ${path.basename(imagePath)} to ${path.basename(outputFile)}`);
    }
  } catch (e) {
    log.error(`Error converting ${path.basename(imagePath)}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Get images that do not have a corresponding WebP file.
 */
async function getMissingImages(directory: string, originalImages: string[]): Promise<string[]> {
  try {
    const files = await fs.promises.readdir(directory);
    const webpFiles = new Set(
      files
        .filter(file => path.extname(file).toLowerCase() === '.webp')
        .map(file => path.basename(file, '.webp'))
    );

    return originalImages.filter(image => {
      const baseName = path.basename(image, path.extname(image));
      return !webpFiles.has(baseName);
    });
  } catch (e) {
    log.error('Error checking for missing images: %s', e instanceof Error ? e.message : String(e));
    return [];
  }
}

/**
 * Main function to convert images to WebP format.
 */
async function main(): Promise<void> {
  try {
    const scriptDir = path.dirname(require.main?.filename || '');
    process.chdir(scriptDir);

    log.info(`Script directory: ${scriptDir}`);

    const originalImages = await getImages(scriptDir);

    if (originalImages.length === 0) {
      log.info('No images found in the directory.');
      return;
    }

    const missingImages = await getMissingImages(scriptDir, originalImages);

    if (missingImages.length > 0) {
      log.info(`Found %s missing WebP conversions. Starting conversion... ${missingImages.length}`);
    } else {
      log.info('No missing WebP conversions found. Converting all images...');
    }

    const imagesToConvert = missingImages.length > 0 ? missingImages : originalImages;

    const startTime = performance.now();

    await Promise.all(imagesToConvert.map(image => convertToWebp(image)));

    const elapsedTime = (performance.now() - startTime) / 1000;
    log.info(`Task completed in ${elapsedTime.toFixed(4)} seconds`);
  } catch (e) {
    log.error(`Error in main function: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (require.main === module) {
  (async () => {
    await main();
  })();
}
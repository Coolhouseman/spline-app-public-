/**
 * Simple script to upload images to Vercel Blob
 * 
 * Usage:
 * 1. Put your images in a folder (e.g., ./images-to-upload/)
 * 2. Run: node upload-images.js
 * 
 * Make sure BLOB_READ_WRITE_TOKEN is in your .env file
 */

const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const IMAGES_FOLDER = './images-to-upload'; // Change this to your images folder

async function uploadImages() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  
  if (!token) {
    console.error('❌ BLOB_READ_WRITE_TOKEN not found in .env.local');
    process.exit(1);
  }

  // Check if folder exists
  if (!fs.existsSync(IMAGES_FOLDER)) {
    console.error(`❌ Folder "${IMAGES_FOLDER}" not found. Create it and add your images.`);
    process.exit(1);
  }

  const files = fs.readdirSync(IMAGES_FOLDER).filter(file => 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
  );

  if (files.length === 0) {
    console.error(`❌ No image files found in "${IMAGES_FOLDER}"`);
    process.exit(1);
  }

  console.log(`📤 Found ${files.length} image(s) to upload...\n`);

  const results = [];

  for (const file of files) {
    try {
      const filePath = path.join(IMAGES_FOLDER, file);
      const fileBuffer = fs.readFileSync(filePath);
      
      console.log(`Uploading: ${file}...`);
      
      const blob = await put(file, fileBuffer, {
        access: 'public',
        token: token,
      });

      results.push({
        filename: file,
        url: blob.url,
      });

      console.log(`✅ Uploaded: ${blob.url}\n`);
    } catch (error) {
      console.error(`❌ Error uploading ${file}:`, error.message);
    }
  }

  // Save results to a file
  const resultsPath = './uploaded-images.json';
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log(`\n✨ Done! ${results.length} image(s) uploaded.`);
  console.log(`📋 URLs saved to: ${resultsPath}`);
  console.log('\nCopy these URLs and use them in your code:');
  results.forEach(r => {
    console.log(`  ${r.filename}: ${r.url}`);
  });
}

uploadImages().catch(console.error);


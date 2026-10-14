import {chromium} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});
const page=await browser.newPage({viewport:{width:256,height:256}});
await page.setContent(`<style>body{margin:0;background:transparent}</style>${fs.readFileSync('assets/icon.svg','utf8')}`);
const png=await page.screenshot({path:'assets/icon.png',omitBackground:true});
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
fs.writeFileSync('assets/icon.ico',Buffer.concat([header,png]));
await browser.close();

// Store decoded, bounded raster images so imports remain portable and small.
export async function importImage(file, kind) {
  const logo = kind === 'logo';
  const allowed = logo ? ['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon'] : ['image/png','image/jpeg','image/webp'];
  if (!allowed.includes(file.type)) throw Error(logo ? '请选择 PNG、JPG、WebP 或 ICO 图片' : '请选择 PNG、JPG 或 WebP 图片');
  if (file.size > (logo ? 4 : 8) * 1024 * 1024) throw Error(logo ? 'Logo 请控制在 4 MB 以内' : '背景图片请控制在 8 MB 以内');
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode().catch(() => { throw Error('图片无法读取，请选择有效的图片文件'); });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 64000000) throw Error('图片尺寸过大，请使用不超过 6400 万像素的图片');
    const scale = Math.min(1, (logo ? 256 : 2560) / Math.max(img.naturalWidth,img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height = Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx = canvas.getContext('2d');
    if (!logo) { ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height); }
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL(logo?'image/png':'image/jpeg',.88);
  } finally { URL.revokeObjectURL(url); }
}

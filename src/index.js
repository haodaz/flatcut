/**
 * flatcut — 给 AI 生成的扁平插画去底。
 *
 * 为什么不是一句 `remove near-white pixels`：
 *
 * 1) 生成模型给的「白底」通常不是纯白。
 *    通义万相常给米白（约 249,241,215），Midjourney 常给冷灰白。
 *    按「r,g,b 都 > 232 且饱和度低」判断会漏掉米白。
 *    这里改成按实测的角落颜色做容差匹配——底色由图自己说了算。
 *
 * 2) 主体内部常有和背景一样浅的区域。
 *    一只老虎的肚子、嘴套、耳朵内侧都是米色。全局颜色匹配会在它们
 *    身上打出窟窿。所以必须用连通区域扩散，只删「和边缘连着的」。
 *
 * 3) 但也不能从所有边缘像素种子扩散。
 *    主体常常被画面裁断——老虎的肚子一直延伸到图片下边缘，
 *    从下边缘扩散会顺着肚子一路吃进去。
 *    这里只从四角种子扩散：背景是环绕主体的一块连通区域，
 *    四角足够覆盖它，而被主体隔开的内部浅色区不会被波及。
 *
 * 4) 边缘要羽化。
 *    硬切出来的边放到深色背景上会出现一圈底色描边。
 *    紧挨背景的那一圈按「离背景色多远」给部分不透明度。
 */

/**
 * @param {import('sharp').Sharp | string | Buffer} input
 * @param {{tolerance?: number, trim?: boolean, sharp?: any}} [opts]
 *   tolerance — RGB 欧氏距离阈值，默认 34。底色有噪点或渐变时调大。
 *   trim      — 裁掉四周全透明的边，默认 true。
 *   sharp     — 传入 sharp 实例；不传则 import('sharp')。
 * @returns {Promise<import('sharp').Sharp>}
 */
export async function flatcut(input, opts = {}) {
  const sharp = opts.sharp ?? (await import('sharp')).default;
  const TOL = opts.tolerance ?? 34;

  const {data, info} = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const {width: W, height: H} = info;
  const at = p => p * 4;

  // 背景色取四角平均：比写死一个值稳，不同批次出图底色会有细微差别
  const corners = [0, W - 1, (H - 1) * W, (H - 1) * W + (W - 1)];
  const bgRef = [0, 1, 2].map(c =>
    Math.round(corners.reduce((s, p) => s + data[at(p) + c], 0) / corners.length),
  );

  const dist = p => {
    const i = at(p);
    return Math.hypot(
      data[i] - bgRef[0],
      data[i + 1] - bgRef[1],
      data[i + 2] - bgRef[2],
    );
  };

  // 只从四角扩散（见上面第 3 条）
  const seen = new Uint8Array(W * H);
  const bg = new Uint8Array(W * H);
  const stack = corners.slice();
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (dist(p) >= TOL) continue;
    bg[p] = 1;
    const x = p % W;
    const y = (p / W) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W);
    if (y < H - 1) stack.push(p + W);
  }

  for (let p = 0; p < W * H; p++) {
    const i = at(p);
    if (bg[p]) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % W;
    const y = (p / W) | 0;
    const nearBg =
      (x > 0 && bg[p - 1]) ||
      (x < W - 1 && bg[p + 1]) ||
      (y > 0 && bg[p - W]) ||
      (y < H - 1 && bg[p + W]);
    // 羽化（见上面第 4 条）
    if (nearBg) {
      data[i + 3] = Math.round(Math.max(0, Math.min(255, (dist(p) / TOL) * 255)));
    }
  }

  let out = sharp(data, {raw: {width: W, height: H, channels: 4}});
  if (opts.trim !== false) out = out.trim({threshold: 1});
  return out.png();
}

export default flatcut;

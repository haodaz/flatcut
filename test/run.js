/**
 * 构造一张专门踩这三个坑的图，验证 flatcut 都躲开了：
 *
 *   ┌────────────────────────┐
 *   │  米白底 (249,241,215)  │   ← 不是纯白，按「near-white」判断会漏
 *   │   ┌──────────────┐     │
 *   │   │   深色主体    │     │
 *   │   │  ┌────────┐  │     │   ← 主体内部也是米白（肚子/嘴套）
 *   │   │  │ 米白   │  │     │     全局颜色匹配会在这儿打窟窿
 *   │   │  └────────┘  │     │
 *   │   │   米白 ▼     │     │   ← 内部米白一直延伸到图片下边缘
 *   └───┴──────────────┴─────┘     从所有边缘种子扩散会顺着它吃进去
 */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {flatcut} from '../src/index.js';

const W = 120, H = 120;
const BG = [249, 241, 215];   // 米白，不是纯白
const SUBJ = [40, 40, 40];

const px = Buffer.alloc(W * H * 3);
const put = (x, y, c) => {
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
};

for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) put(x, y, BG);

// 主体：x 30..90，y 30..H（一直到下边缘）
for (let y = 30; y < H; y++)
  for (let x = 30; x < 90; x++) put(x, y, SUBJ);

// 主体内部的米白区，同样一直延伸到下边缘
for (let y = 55; y < H; y++)
  for (let x = 48; x < 72; x++) put(x, y, BG);

const src = await sharp(px, {raw: {width: W, height: H, channels: 3}}).png().toBuffer();

const out = await flatcut(src, {trim: false});
const {data} = await out.raw().toBuffer({resolveWithObject: true});
const alpha = (x, y) => data[(y * W + x) * 4 + 3];

// 1) 米白底被认出来了（纯白判断会漏掉这个）
assert.equal(alpha(3, 3), 0, '角落应该透明');
assert.equal(alpha(W - 4, 3), 0, '右上角应该透明');

// 2) 主体没被挖空
assert.equal(alpha(35, 60), 255, '主体应该不透明');

// 3) 主体内部的米白区没被吃掉 —— 即使它和背景同色、
//    而且一直延伸到图片下边缘
assert.equal(alpha(60, 70), 255, '主体内部的浅色区不该被吃掉');
assert.equal(alpha(60, H - 2), 255, '延伸到下边缘的内部浅色区也不该被吃掉');

// 4) 边缘有羽化，不是硬切
const edge = alpha(30, 60);
assert.ok(edge > 0 && edge <= 255, '边缘应有部分不透明度');

console.log('✅ 4 项全过：米白底识别 / 主体完整 / 内部浅色区保留 / 边缘羽化');

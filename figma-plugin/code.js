// PICK Studio가 내보낸 pick-figma/1 JSON을 편집 가능한 Figma 프레임으로 만듭니다.
figma.showUI(__html__, { width: 360, height: 250 });

const STYLE_WEIGHT = { 'Thin': 100, 'ExtraLight': 200, 'Extra Light': 200, 'Light': 300, 'Semilight': 350, 'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Semi Bold': 600, 'Semibold': 600, 'Bold': 700, 'ExtraBold': 800, 'Extra Bold': 800, 'Black': 900, 'Heavy': 900 };
// Pretendard가 없으면 한글이 되는 글꼴로 차례대로 대체합니다.
const FAMILIES = ['Pretendard', 'Pretendard Variable', 'Pretendard JP', 'Noto Sans KR', 'Spoqa Han Sans Neo', 'Malgun Gothic', 'Inter'];

function status(text) { figma.ui.postMessage({ type: 'status', text: text }); }

async function fontResolver() {
  const available = await figma.listAvailableFontsAsync();
  const byFamily = {};
  for (const f of available) {
    const w = STYLE_WEIGHT[f.fontName.style];
    if (w === undefined) continue;
    (byFamily[f.fontName.family] = byFamily[f.fontName.family] || []).push({ style: f.fontName.style, weight: w });
  }
  const family = FAMILIES.find(function (name) { return byFamily[name]; });
  const cache = {};
  return {
    family: family,
    get: async function (weight) {
      if (cache[weight]) return cache[weight];
      let best = null;
      for (const s of byFamily[family]) {
        const d = Math.abs(s.weight - weight);
        if (!best || d < best.d || (d === best.d && s.weight < best.weight)) best = { d: d, weight: s.weight, style: s.style };
      }
      const fontName = { family: family, style: best.style };
      await figma.loadFontAsync(fontName);
      return (cache[weight] = fontName);
    }
  };
}

function paint(c) { return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }; }

async function addText(frame, layer, fonts) {
  const t = figma.createText();
  frame.appendChild(t);
  t.fontName = await fonts.get(layer.weight);
  t.characters = layer.characters;
  t.name = layer.name;
  t.fontSize = layer.fontSize;
  t.lineHeight = { unit: 'PIXELS', value: layer.lineHeight };
  t.letterSpacing = { unit: 'PIXELS', value: layer.letterSpacing };
  t.textAlignHorizontal = layer.align;
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  t.fills = [paint(layer.lines[0].color)];
  let offset = 0;
  for (const line of layer.lines) {
    if (line.length) t.setRangeFills(offset, offset + line.length, [paint(line.color)]);
    offset += line.length + 1;
  }
  t.relativeTransform = layer.transform;
  if (layer.anchorX !== null && layer.anchorX !== undefined) t.x = layer.anchorX - t.width;
}

function addImage(frame, layer) {
  const rect = figma.createRectangle();
  frame.appendChild(rect);
  rect.name = layer.name;
  rect.resize(layer.w, layer.h);
  rect.x = layer.x;
  rect.y = layer.y;
  const image = figma.createImage(figma.base64Decode(layer.data));
  rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
}

async function importPackage(pkg) {
  if (!pkg || pkg.format !== 'pick-figma/1' || !Array.isArray(pkg.cards)) throw new Error('PICK Studio에서 내보낸 Figma용 JSON이 아닙니다.');
  const fonts = await fontResolver();
  const page = figma.currentPage;
  let startX = 0;
  for (const node of page.children) startX = Math.max(startX, node.x + node.width + 200);
  const frames = [];
  for (let i = 0; i < pkg.cards.length; i++) {
    const card = pkg.cards[i];
    status('카드 ' + (i + 1) + ' / ' + pkg.cards.length + ' 만드는 중…');
    const frame = figma.createFrame();
    frame.name = pkg.keyword + ' · ' + card.name;
    frame.resize(pkg.width, pkg.height);
    frame.x = startX + i * (pkg.width + 80);
    frame.y = 0;
    frame.clipsContent = true;
    frame.fills = [];
    page.appendChild(frame);
    for (const layer of card.layers) {
      if (layer.type === 'image') addImage(frame, layer);
      else if (layer.type === 'text') await addText(frame, layer, fonts);
    }
    frames.push(frame);
  }
  page.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  const fallback = fonts.family.indexOf('Pretendard') === 0 ? '' : ' (Pretendard가 없어 ' + fonts.family + ' 글꼴로 대체)';
  const done = frames.length + '장의 카드를 만들었습니다' + fallback + '.';
  status(done);
  figma.notify(done);
}

figma.ui.onmessage = async function (msg) {
  if (msg.type !== 'import') return;
  try { await importPackage(JSON.parse(msg.data)); }
  catch (e) { status('가져오기 실패: ' + e.message); figma.notify('가져오기 실패: ' + e.message, { error: true }); }
};

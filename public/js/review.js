// 검토 · 승인: 출처 확인 체크(PATCH /api/sources/:id) + 상태 변경 버튼(PATCH /api/magazines/:id/status)
// 승인 불가 사유는 서버와 같은 규칙(shared/status-rules.js)으로 미리 보여 주고, 최종 판단은 서버가 합니다.
import { api } from './api.js';
import { mountLayout } from './layout.js';
import { $, $$, esc, statusBadge, typeBadge, toast, action, confirmDialog, showError } from './ui.js';
import { STATUS_FLOW, STATUS_LABEL, nextStatus, approvalBlockers, canExport } from '/shared/status-rules.js';

const NEXT_ACTION = {
  REVIEW: { label: '검토 요청하기', hint: '작성을 마쳤으면 검토 단계로 넘깁니다.' },
  APPROVED: { label: '승인하기', hint: '출처를 모두 확인했으면 승인합니다. 승인 후 내용을 고치면 다시 검토 중으로 돌아갑니다.' },
  PUBLISHED: { label: '게시 완료로 표시', hint: '인스타그램에 올렸으면 게시 완료로 바꿉니다. 이후에는 내용을 수정할 수 없습니다.' },
};
const FIELD_NAME = { title: '헤드라인', body: '본문', note: '하단 문구', caption: '캡션' };

await mountLayout('mine');
const content = $('#content');
const id = new URLSearchParams(location.search).get('id');
let mag;

if (!/^\d+$/.test(id || '')) showError(content, '주소에 매거진 번호가 없습니다.');
else {
  try {
    mag = (await api(`/api/magazines/${id}`)).magazine;
    if (!mag.isOwner) {
      showError(content, '검토·승인은 매거진 작성자만 할 수 있습니다.');
      content.querySelector('.empty-state').insertAdjacentHTML('beforeend', ` <a class="primary" href="/magazine.html?id=${mag.id}">상세 보기</a>`);
    } else render();
  } catch (err) {
    if (err.status !== 401) showError(content, err.status === 404 ? '삭제되었거나 없는 매거진입니다.' : err.message);
  }
}

function render() {
  document.title = `검토 · ${mag.title} · PICK Studio`;
  $('#crumb').textContent = `${mag.title} · 검토`;
  content.innerHTML = `
    <div class="detail-title">
      <div><h1>${esc(mag.title)}</h1><div class="sub" id="badges"></div></div>
      <div class="detail-actions"><a class="secondary" href="/edit.html?id=${mag.id}">수정</a><a class="secondary" href="/magazine.html?id=${mag.id}">상세 보기</a><a class="secondary" id="exportLink" href="/export.html?id=${mag.id}">내보내기</a></div>
    </div>
    <div class="detail-layout review-layout">
      <div class="info-stack">
        <section class="info-block panel" aria-labelledby="flowTitle"><h2 id="flowTitle">진행 단계</h2>
          <ol class="stepper" id="stepper"></ol>
          <div id="nextBox"></div>
        </section>
        <section class="info-block panel" aria-labelledby="srcTitle"><h2 id="srcTitle">출처 확인 <span class="muted" id="srcCount"></span></h2>
          <p class="muted" style="margin:0 0 12px">원문을 열어 카드 내용과 맞는지 확인한 뒤 체크하세요. 모든 출처가 확인돼야 승인할 수 있습니다.</p>
          <ul class="check-list" id="sourceList"></ul>
        </section>
      </div>
      <section class="info-block panel" id="voice" aria-labelledby="voiceTitle"><h2 id="voiceTitle">말투 검사</h2><p class="muted">검사 중…</p></section>
    </div>`;
  renderStatus();
  renderSources();
  loadVoice();
}

function renderStatus() {
  $('#badges').innerHTML = `${statusBadge(mag.status)}${typeBadge(mag.type)}<span>카드 ${mag.cards.length}장</span>`;
  const at = STATUS_FLOW.indexOf(mag.status);
  $('#stepper').innerHTML = STATUS_FLOW.map((s, i) => `<li class="${i < at ? 'done' : i === at ? 'current' : ''}"${i === at ? ' aria-current="step"' : ''}><b>${String(i + 1).padStart(2, '0')}</b>${STATUS_LABEL[s]}</li>`).join('');
  const next = nextStatus(mag.status);
  const box = $('#nextBox');
  $('#exportLink').hidden = !canExport(mag.status);
  if (!next) {
    box.innerHTML = '<p class="ready">게시 완료된 매거진입니다. 더 바꿀 단계가 없습니다.</p>';
    return;
  }
  // APPROVED·PUBLISHED 로 가려면 출처 조건이 필요 (서버와 같은 함수)
  const blockers = next === 'APPROVED' || next === 'PUBLISHED' ? approvalBlockers(mag.sources) : [];
  const a = NEXT_ACTION[next];
  box.innerHTML = `
    <p class="muted" style="margin:0 0 10px">${esc(a.hint)}</p>
    <button class="primary" id="nextBtn" ${blockers.length ? 'disabled aria-describedby="blockers"' : ''}>${esc(a.label)} → ${esc(STATUS_LABEL[next])}</button>
    ${blockers.length ? `<div class="blockers" id="blockers" role="status"><b>승인할 수 없는 이유</b><ul>${blockers.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`
      : next === 'APPROVED' ? '<p class="ready">출처를 모두 확인했어요. 승인할 수 있습니다.</p>' : ''}
    ${canExport(mag.status) ? `<p class="muted" style="margin:12px 0 0">승인된 매거진은 <a href="/export.html?id=${mag.id}" style="color:var(--link)">카드 이미지 ZIP으로 내보낼</a> 수 있어요.</p>` : ''}`;
  $('#nextBtn').onclick = action(async () => {
    if (next === 'PUBLISHED' && !(await confirmDialog('게시 완료로 표시', '게시 완료 후에는 카드·제목·캡션을 수정할 수 없습니다. 계속할까요?', { ok: '게시 완료' }))) return;
    try {
      const r = await api(`/api/magazines/${mag.id}/status`, { method: 'PATCH', body: { status: next } });
      mag.status = r.magazine.status;
      toast(`${STATUS_LABEL[r.from]} → ${STATUS_LABEL[r.to]}`);
    } catch (err) {
      // 다른 창에서 바뀐 경우 등: 서버가 알려 준 이유를 보여 주고 최신 상태로 다시 그림
      toast(err.message);
      mag = (await api(`/api/magazines/${mag.id}`)).magazine;
      renderSources();
    }
    renderStatus();
  });
}

function renderSources() {
  const done = mag.sources.filter(s => s.verified).length;
  $('#srcCount').textContent = `${done}/${mag.sources.length}`;
  const locked = mag.status === 'PUBLISHED';
  $('#sourceList').innerHTML = mag.sources.length ? mag.sources.map(s => `
    <li class="${s.verified ? 'ok' : ''}">
      <input type="checkbox" id="src${s.id}" data-src="${s.id}" ${s.verified ? 'checked' : ''} ${locked ? 'disabled' : ''}>
      <label for="src${s.id}">${esc(s.title)}<small>${esc(s.outlet)} · ${s.verified ? '확인 완료' : '확인 전'}</small></label>
      <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">원문 ↗</a>
    </li>`).join('') : `<li><span class="muted">출처가 없습니다. <a href="/edit.html?id=${mag.id}">편집 화면 › 출처</a>에서 추가하세요.</span></li>`;
  $$('[data-src]').forEach(box => {
    box.onchange = async () => {
      box.disabled = true;
      try {
        const r = await api(`/api/sources/${box.dataset.src}`, { method: 'PATCH', body: { verified: box.checked } });
        Object.assign(mag.sources.find(s => s.id === r.source.id), { verified: r.source.verified });
        if (r.magazine.reverted) toast('승인 완료였던 매거진의 출처가 바뀌어 검토 중으로 돌아갔어요.');
        mag.status = r.magazine.status;
      } catch (err) {
        box.checked = !box.checked;
        toast(err.message);
      }
      renderSources();
      renderStatus();
    };
  });
}

async function loadVoice() {
  const box = $('#voice');
  try {
    const v = await api(`/api/magazines/${mag.id}/voice`);
    const row = x => `<p><b>${esc(FIELD_NAME[x.field] || '')} · ${esc(x.label)}</b>${x.match ? ` <q>${esc(x.match)}</q>` : ''}<small>${esc(x.fix)}</small></p>`;
    const cards = v.cards.map((c, i) => `<div class="voice-card"><h3>${String(i + 1).padStart(2, '0')} · ${esc((mag.cards[i]?.headline || '').replace(/[[\]]/g, '').replace(/\n/g, ' ').slice(0, 30))}</h3>
      <div class="lint" style="background:none;border:0;padding:0">${c.issues.length ? c.issues.map(row).join('') : '<p class="ok">사람 말투로 읽혀요.</p>'}</div></div>`).join('');
    box.innerHTML = `<h2 id="voiceTitle">말투 검사 <span class="score" style="font-size:22px">${v.score}<small>/ 100</small></span></h2>
      <p class="muted" style="margin:0 0 6px">AI 말투(광고식 권유, 빈 수식어, 번역투, 면책 문구 등)로 읽히는 곳입니다. 승인 조건은 아니지만 고치면 점수가 오릅니다.</p>
      ${cards}
      ${v.overall.length ? `<div class="voice-card"><h3>캡션 · 전체</h3><div class="lint" style="background:none;border:0;padding:0">${v.overall.map(row).join('')}</div></div>` : ''}`;
  } catch (err) {
    box.innerHTML = `<h2>말투 검사</h2><p class="muted">${esc(err.message)}</p>`;
  }
}

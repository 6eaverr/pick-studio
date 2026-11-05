import test from 'node:test';
import assert from 'node:assert/strict';
import {lintText,lintCards,lintScenes,scoreHook,inventedNumbers} from '../shared/voice.js';

const ids=list=>list.map(x=>x.id);

test('AI 말투를 잡아낸다', () => {
  assert.ok(ids(lintText('익숙한 곡의 여운을 안고, 악기들이 맞물리는 재미까지 따라가 보고 싶을 때 추천해요.','body')).includes('invite'));
  assert.ok(ids(lintText('익숙한 곡의 여운을 안고 들어보세요.','body')).includes('metaphor'));
  assert.ok(ids(lintText('2023년 1월 27일 나온 EP에서 타이틀곡을 맡은 곡이에요. 작사·작곡은 김승주.','body')).includes('wiki'));
  assert.ok(ids(lintText('에디터 감상: 라이브가 더 좋은 곡','note')).includes('disclaimer'));
  assert.ok(ids(lintText('날씨의 요정 다음엔\n뭘 들을까','cover')).includes('weakq'));
});

test('사람 말투는 그냥 통과시킨다', () => {
  for(const t of ['만화 주인공이 된 기분이 필요한 날. 첫 EP 타이틀곡.','기타 리프 사이로 드럼이 파고든다. 걸음이 빨라지는 곡.','넷 중에 제일 힘 빼고 부른 곡.'])
    assert.deepEqual(lintText(t,'body'),[]);
});

test('표지에 설명문이 있으면 크게 감점하고, 고친 원고는 점수가 오른다', () => {
  const card=(title,body='',note='')=>({title,body,note});
  const bad={caption:'',cards:[card('날씨의 요정 다음엔\n뭘 들을까','다음 장부터 네 곡을 순서대로 따라가 보세요. 이어 듣기 좋은 순서로 골랐어요.'),card('시작은 역시\n날씨의 요정','두 번째 EP의 타이틀곡이에요. 라이브 영상도 들어보세요.','에디터 감상: 합이 또렷한 곡'),card('마무리','저장해 두세요.')]};
  const good={caption:'',cards:[card('히트곡만 듣고\n[이 밴드 안다고 하지 마]'),card('날씨의 요정\n일단 여기서 시작','밴드를 대표하는 곡. 라이브 영상으로 한 번 더.'),card('페스티벌 가기 전에\n저장','입문곡은 A or B? 댓글로.')]};
  assert.ok(ids(lintCards(bad).issues).includes('coverBody'));
  assert.ok(lintCards(good).score>lintCards(bad).score+40);
});

test('릴스: 보조 문구의 날짜 나열과 긴 자막을 잡는다', () => {
  const r=lintScenes({caption:'',scenes:[{text:'여름 끝, 울기보다\n뛰는 게 낫지',sub:''},{text:'실리카겔\nTik Tak Tok',sub:'feat. So!YoON! · 2023.08.19 발매'}]});
  assert.ok(r.issues.some(x=>x.scene===1&&x.field==='sub'&&x.id==='wiki'));
});

test('표지 후보 점수: 단정·대비가 설명형보다 높다', () => {
  assert.ok(scoreHook('히트곡은 뺐다\n실리카겔 숨은 3곡').score>scoreHook('실리카겔 노래 추천').score);
  assert.ok(scoreHook('실리카겔에 대해 알아보자').score<50);
});

test('출처에 없는 숫자만 지어낸 것으로 본다', () => {
  const corpus='정규 3집(8/20 발매) 9/26~27 서울 2025년 4월 8일 11곡';
  assert.deepEqual(inventedNumbers('정규 3집 들고 나간다',corpus),[]);
  assert.deepEqual(inventedNumbers('입문 4곡',corpus),[]);
  assert.deepEqual(inventedNumbers('3년 만의 신보',corpus),['3년']);
  assert.deepEqual(inventedNumbers('2024년 데뷔',corpus),['2024년']);
});

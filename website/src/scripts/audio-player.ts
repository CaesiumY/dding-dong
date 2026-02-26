/**
 * 전역 오디오 컨트롤러 — 바닐라 JS, 이벤트 위임
 * Islands/프레임워크 없이 재생 버튼을 관리합니다.
 *
 * 재생 버튼 상태: Idle → Playing → Finished → Idle
 * 배타적 재생: 한 번에 하나만 재생, 이전 것은 fade-out
 */

let currentAudio: HTMLAudioElement | null = null;
let currentBtn: HTMLElement | null = null;

/** 재생 버튼 상태 업데이트 */
function setState(btn: HTMLElement, state: 'idle' | 'playing' | 'finished') {
  const icon = btn.querySelector('.play-icon') as HTMLElement;
  const wave = btn.querySelector('.wave-bars') as HTMLElement;
  const row = btn.closest('.audio-row') as HTMLElement;
  const onomatopoeia = row?.querySelector('.onomatopoeia') as HTMLElement;

  // 팩 테마색
  const color = btn.dataset.packColor || '#334155';

  btn.dataset.state = state;

  if (state === 'idle') {
    btn.style.backgroundColor = '';
    btn.style.color = '';
    btn.style.boxShadow = '';
    if (icon) { icon.innerHTML = playTriangle(); icon.style.display = ''; }
    if (wave) wave.style.display = 'none';
    if (row) row.style.backgroundColor = '';
    if (onomatopoeia) {
      onomatopoeia.style.color = '';
      onomatopoeia.style.fontWeight = '';
      onomatopoeia.style.transform = '';
    }
  } else if (state === 'playing') {
    btn.style.backgroundColor = color;
    btn.style.color = '#fff';
    btn.style.boxShadow = `0 0 0 4px ${color}33`;
    if (icon) icon.style.display = 'none';
    if (wave) { wave.style.display = 'flex'; wave.style.color = '#fff'; }
    if (row) row.style.backgroundColor = `${color}0D`; // 5% tint
    if (onomatopoeia) {
      onomatopoeia.style.color = color;
      onomatopoeia.style.fontWeight = '700';
      onomatopoeia.style.transform = 'scale(1.1)';
    }
  } else if (state === 'finished') {
    btn.style.backgroundColor = '';
    btn.style.color = '';
    btn.style.boxShadow = '';
    if (icon) { icon.innerHTML = checkMark(); icon.style.display = ''; }
    if (wave) wave.style.display = 'none';
    if (row) row.style.backgroundColor = '';
    if (onomatopoeia) {
      onomatopoeia.style.color = '';
      onomatopoeia.style.fontWeight = '';
      onomatopoeia.style.transform = '';
    }
    // 300ms 후 idle로 복귀
    setTimeout(() => setState(btn, 'idle'), 300);
  }
}

function playTriangle(): string {
  return '<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><path d="M0 0L12 7L0 14Z"/></svg>';
}

function checkMark(): string {
  return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7L5.5 10.5L12 3.5"/></svg>';
}

/** fade-out 현재 재생 (200ms) */
function fadeOutCurrent(): Promise<void> {
  return new Promise((resolve) => {
    if (!currentAudio || currentAudio.paused) {
      resolve();
      return;
    }
    const audio = currentAudio;
    const startVolume = audio.volume;
    const steps = 10;
    const interval = 200 / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVolume * (1 - step / steps));
      if (step >= steps) {
        clearInterval(timer);
        audio.pause();
        audio.currentTime = 0;
        audio.volume = startVolume;
        resolve();
      }
    }, interval);
  });
}

/** 클릭 이벤트 핸들러 (이벤트 위임) */
document.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('.play-btn') as HTMLElement;
  if (!btn) return;

  const soundUrlAttr = btn.dataset.soundUrl;
  if (!soundUrlAttr) return;

  // 같은 버튼 클릭 시 토글
  if (currentBtn === btn && currentAudio && !currentAudio.paused) {
    await fadeOutCurrent();
    if (currentBtn) setState(currentBtn, 'idle');
    currentAudio = null;
    currentBtn = null;
    return;
  }

  // 이전 재생 정지
  if (currentBtn && currentBtn !== btn) {
    await fadeOutCurrent();
    setState(currentBtn, 'idle');
  }

  // 새 재생 시작
  const audio = new Audio(soundUrlAttr);
  currentAudio = audio;
  currentBtn = btn;

  setState(btn, 'playing');

  // fade-in (150ms)
  audio.volume = 0;
  audio.play().catch(() => {
    setState(btn, 'idle');
    currentAudio = null;
    currentBtn = null;
  });

  const targetVolume = 1;
  const fadeSteps = 8;
  const fadeInterval = 150 / fadeSteps;
  let fadeStep = 0;
  const fadeTimer = setInterval(() => {
    fadeStep++;
    audio.volume = Math.min(targetVolume, targetVolume * (fadeStep / fadeSteps));
    if (fadeStep >= fadeSteps) clearInterval(fadeTimer);
  }, fadeInterval);

  // 재생 완료 시
  audio.addEventListener('ended', () => {
    if (currentBtn === btn) {
      setState(btn, 'finished');
      currentAudio = null;
      currentBtn = null;
    }
  }, { once: true });
});

// 초인종 버튼 (Hero 섹션)
document.addEventListener('click', (e) => {
  const doorbell = (e.target as HTMLElement).closest('.doorbell-btn') as HTMLElement;
  if (!doorbell) return;

  const soundUrlAttr = doorbell.dataset.soundUrl;
  if (!soundUrlAttr) return;

  // 흔들림 애니메이션
  doorbell.classList.add('doorbell-wobble');
  doorbell.addEventListener('animationend', () => {
    doorbell.classList.remove('doorbell-wobble');
  }, { once: true });

  // 음파 방사 동심원
  const container = doorbell.parentElement;
  if (container) {
    for (let i = 0; i < 3; i++) {
      const wave = document.createElement('div');
      wave.className = 'sound-wave absolute inset-0 rounded-full border-2 border-hobak pointer-events-none';
      wave.style.animationDelay = `${i * 0.15}s`;
      container.style.position = 'relative';
      container.appendChild(wave);
      wave.addEventListener('animationend', () => wave.remove(), { once: true });
    }
  }

  // 사운드 재생
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audio = new Audio(soundUrlAttr);
  audio.play().catch(() => {});
  currentAudio = audio;
});

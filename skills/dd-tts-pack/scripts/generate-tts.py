#!/usr/bin/env python3
"""
dding-dong TTS 사운드 팩 생성 스크립트

Voice Cloning 모드와 CustomVoice 모드를 지원합니다.
생성된 WAV는 44100Hz, 16-bit PCM, mono로 변환됩니다.

사용법:
  # 미리듣기 (클로닝)
  python3 generate-tts.py --voice-mode clone --mode preview \
    --ref-audio ref.wav --ref-text "참조 텍스트" \
    --text "작업이 완료되었습니다." \
    --language Korean --output preview.wav

  # 미리듣기 (CustomVoice)
  python3 generate-tts.py --voice-mode custom --mode preview \
    --speaker Sohee \
    --text "작업이 완료되었습니다." --instruct "밝은 어조로" \
    --language Korean --output preview.wav

  # 배치 생성
  python3 generate-tts.py --voice-mode clone --mode batch \
    --ref-audio ref.wav --ref-text "참조 텍스트" \
    --config config.json --output-dir ./pack-dir

의존성: qwen-tts, torch, soundfile, numpy
"""

import argparse
import json
import sys
import os

try:
    import numpy as np
    import soundfile as sf
    import torch
except ImportError as e:
    print(json.dumps({'ok': False, 'error': f'필수 패키지 누락: {e}. pip install -U qwen-tts 를 실행해주세요.'}))
    sys.exit(0)

# ─── 상수 ───────────────────────────────────────────
TARGET_SR = 44100       # dding-dong WAV 표준 샘플레이트
TARGET_BITS = 16        # 16-bit PCM
MAX_DURATION_S = 3.0    # 최대 길이 (초)
MIN_DURATION_S = 0.3    # 최소 길이 (초)
FADE_MS = 30            # 페이드 인/아웃 (ms)
SILENCE_THRESHOLD = 0.003  # 무음 판정 진폭 기준
TAIL_PAD_MS = 150       # 뒤쪽 무음 트림 후 여유 (ms)
END_PAD_MS = 100        # 최종 출력 끝에 추가할 무음 (ms, 재생기 호환성)

# TTS 텍스트 종결 부호 (한중일 + 서양)
SENTENCE_ENDINGS = '.!?。！？…'


def ensure_punctuation(text):
    """텍스트 끝에 종결 부호가 없으면 마침표를 추가한다. 앞뒤 공백도 제거."""
    text = text.strip()
    if not text:
        return text
    if text[-1] in SENTENCE_ENDINGS:
        return text
    return text + '.'

# ─── 오디오 후처리 ───────────────────────────────────

def resample(audio, orig_sr, target_sr):
    """선형 보간으로 리샘플링 (scipy 의존성 회피)"""
    if orig_sr == target_sr:
        return audio
    duration = len(audio) / orig_sr
    target_len = int(duration * target_sr)
    indices = np.linspace(0, len(audio) - 1, target_len)
    return np.interp(indices, np.arange(len(audio)), audio).astype(np.float32)


def trim_silence(audio, sr, threshold=SILENCE_THRESHOLD):
    """앞뒤 무음 구간 제거"""
    abs_audio = np.abs(audio)
    # 앞쪽 무음
    start = 0
    window = int(sr * 0.01)  # 10ms 윈도우
    for i in range(0, len(audio) - window, window):
        if np.mean(abs_audio[i:i + window]) > threshold:
            start = max(0, i - window)  # 약간의 여유
            break
    # 뒤쪽 무음 (자연스러운 음성 끝을 보존하기 위해 여유를 더 줌)
    tail_pad = int(sr * TAIL_PAD_MS / 1000)
    end = len(audio)
    for i in range(len(audio) - window, window, -window):
        if np.mean(abs_audio[i - window:i]) > threshold:
            end = min(len(audio), i + tail_pad)
            break
    return audio[start:end]


def apply_fade(audio, sr, fade_ms=FADE_MS):
    """페이드 인/아웃 적용"""
    fade_samples = int(sr * fade_ms / 1000)
    if len(audio) < fade_samples * 2:
        return audio
    audio = audio.copy()
    # Fade in
    audio[:fade_samples] *= np.linspace(0, 1, fade_samples).astype(np.float32)
    # Fade out
    audio[-fade_samples:] *= np.linspace(1, 0, fade_samples).astype(np.float32)
    return audio


def enforce_duration(audio, sr, min_s=MIN_DURATION_S, max_s=MAX_DURATION_S):
    """최소/최대 길이 제한"""
    min_samples = int(sr * min_s)
    max_samples = int(sr * max_s)

    if len(audio) > max_samples:
        audio = audio[:max_samples]
    elif len(audio) < min_samples:
        # 짧으면 무음 패딩
        pad = np.zeros(min_samples - len(audio), dtype=np.float32)
        audio = np.concatenate([audio, pad])
    return audio


def to_int16(audio):
    """float32 → 16-bit PCM 변환"""
    audio = np.clip(audio, -1.0, 1.0)
    return (audio * 32767).astype(np.int16)


def postprocess_and_save(audio, orig_sr, output_path):
    """리샘플링 → 무음 트림 → 길이 제한 → 페이드 → 16-bit 변환 → 저장"""
    # float32 정규화
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    if np.max(np.abs(audio)) > 0:
        audio = audio / np.max(np.abs(audio))

    # 스테레오 → 모노
    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    # 리샘플링
    audio = resample(audio, orig_sr, TARGET_SR)

    # 무음 트림
    audio = trim_silence(audio, TARGET_SR)

    # 길이 제한
    audio = enforce_duration(audio, TARGET_SR)

    # 페이드
    audio = apply_fade(audio, TARGET_SR)

    # 끝 무음 패딩 (재생기가 끝부분을 누락하지 않도록)
    end_pad = np.zeros(int(TARGET_SR * END_PAD_MS / 1000), dtype=np.float32)
    audio = np.concatenate([audio, end_pad])

    # 16-bit PCM 변환 및 저장
    audio_int16 = to_int16(audio)
    sf.write(output_path, audio_int16, TARGET_SR, subtype='PCM_16')

    duration = len(audio_int16) / TARGET_SR
    return duration


# ─── TTS 생성 ───────────────────────────────────────

def load_model(voice_mode, model_name=None):
    """모델 로드 (1회)"""
    from qwen_tts import Qwen3TTSModel

    if model_name is None:
        if voice_mode == 'clone':
            model_name = 'Qwen/Qwen3-TTS-12Hz-1.7B-Base'
        else:
            model_name = 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice'

    print(f'[INFO] 모델 로딩 중: {model_name}', file=sys.stderr, flush=True)

    kwargs = {
        'device_map': 'cuda:0',
        'dtype': torch.bfloat16,
    }

    # FlashAttention 2 시도
    try:
        import flash_attn  # noqa: F401
        kwargs['attn_implementation'] = 'flash_attention_2'
        print('[INFO] FlashAttention 2 활성화됨', file=sys.stderr, flush=True)
    except ImportError:
        pass

    model = Qwen3TTSModel.from_pretrained(model_name, **kwargs)
    print('[INFO] 모델 로딩 완료', file=sys.stderr, flush=True)
    return model


def generate_clone(model, text, language, ref_audio, ref_text, voice_clone_prompt=None):
    """Voice Cloning 모드 생성"""
    kwargs = {
        'text': text,
        'language': language,
    }

    if voice_clone_prompt is not None:
        kwargs['voice_clone_prompt'] = voice_clone_prompt
    else:
        kwargs['ref_audio'] = ref_audio
        kwargs['ref_text'] = ref_text if ref_text else None
        if not ref_text:
            kwargs['x_vector_only_mode'] = True

    wavs, sr = model.generate_voice_clone(**kwargs)
    return wavs[0], sr


def generate_custom(model, text, language, speaker, instruct=None):
    """CustomVoice 모드 생성"""
    kwargs = {
        'text': text,
        'language': language,
        'speaker': speaker,
    }
    if instruct:
        kwargs['instruct'] = instruct

    wavs, sr = model.generate_custom_voice(**kwargs)
    return wavs[0], sr


# ─── 메인 ───────────────────────────────────────────

def run_preview(args):
    """단일 샘플 미리듣기"""
    model = load_model(args.voice_mode, args.model)

    text = ensure_punctuation(args.text)
    print(f'[INFO] 미리듣기 생성 중: "{text}"', file=sys.stderr, flush=True)

    if args.voice_mode == 'clone':
        audio, sr = generate_clone(
            model, text, args.language,
            args.ref_audio, args.ref_text
        )
    else:
        # instruct는 감정/스타일 제어 지시문이므로 종결 부호를 추가하지 않음
        audio, sr = generate_custom(
            model, text, args.language,
            args.speaker, args.instruct
        )

    duration = postprocess_and_save(audio, sr, args.output)
    result = {'ok': True, 'output': args.output, 'duration': round(duration, 2), 'sample_rate': TARGET_SR}
    print(json.dumps(result))


def run_batch(args):
    """배치 생성 (전체 이벤트)"""
    with open(args.config, 'r', encoding='utf-8') as f:
        config = json.load(f)

    events = config.get('events', {})
    if not events:
        print(json.dumps({'ok': False, 'error': 'config에 events가 없습니다'}))
        return

    model = load_model(args.voice_mode, args.model)

    # Voice Cloning: 재사용 가능한 프롬프트 생성
    voice_clone_prompt = None
    if args.voice_mode == 'clone' and args.ref_audio:
        print('[INFO] 보이스 클론 프롬프트 생성 중...', file=sys.stderr, flush=True)
        x_vector_only = not args.ref_text
        voice_clone_prompt = model.create_voice_clone_prompt(
            ref_audio=args.ref_audio,
            ref_text=args.ref_text if args.ref_text else None,
            x_vector_only_mode=x_vector_only,
        )
        print('[INFO] 프롬프트 생성 완료', file=sys.stderr, flush=True)

    results = {}
    total = len(events)

    for idx, (event_type, event_cfg) in enumerate(events.items(), 1):
        text = ensure_punctuation(event_cfg.get('text', ''))
        language = event_cfg.get('language', 'Korean')
        # instruct는 감정/스타일 제어 지시문이므로 종결 부호를 추가하지 않음
        instruct = event_cfg.get('instruct', None)
        output_file = event_cfg.get('output_file', f'{event_type.replace(".", "-")}.wav')
        output_path = os.path.join(args.output_dir, output_file)

        print(f'[{idx}/{total}] {event_type} 생성 중: "{text}"', file=sys.stderr, flush=True)

        try:
            if args.voice_mode == 'clone':
                audio, sr = generate_clone(
                    model, text, language,
                    args.ref_audio, args.ref_text,
                    voice_clone_prompt=voice_clone_prompt
                )
            else:
                speaker = config.get('speaker', args.speaker or 'Sohee')
                audio, sr = generate_custom(model, text, language, speaker, instruct)

            duration = postprocess_and_save(audio, sr, output_path)
            results[event_type] = {'ok': True, 'file': output_file, 'duration': round(duration, 2)}
            print(f'[{idx}/{total}] {event_type} ✓ ({duration:.1f}초)', file=sys.stderr, flush=True)

        except Exception as e:
            results[event_type] = {'ok': False, 'error': str(e)}
            print(f'[{idx}/{total}] {event_type} ✗ {e}', file=sys.stderr, flush=True)

    all_ok = all(r['ok'] for r in results.values())
    print(json.dumps({'ok': all_ok, 'results': results, 'sample_rate': TARGET_SR}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description='dding-dong TTS 사운드 팩 생성')
    parser.add_argument('--mode', choices=['preview', 'batch'], required=True,
                        help='preview: 단일 샘플, batch: 전체 이벤트')
    parser.add_argument('--voice-mode', choices=['clone', 'custom'], required=True,
                        help='clone: 보이스 클로닝, custom: CustomVoice')
    parser.add_argument('--model', default=None,
                        help='모델명 (기본: voice-mode에 따라 자동 선택)')

    # Voice Cloning 옵션
    parser.add_argument('--ref-audio', help='참조 음성 파일 경로')
    parser.add_argument('--ref-text', default='', help='참조 음성 트랜스크립트')

    # CustomVoice 옵션
    parser.add_argument('--speaker', default='Sohee', help='화자 이름 (기본: Sohee)')

    # 공통 옵션
    parser.add_argument('--text', help='생성할 텍스트 (preview 모드)')
    parser.add_argument('--instruct', default=None, help='감정/스타일 지시 (선택)')
    parser.add_argument('--language', default='Korean', help='언어 (기본: Korean)')

    # 출력 옵션
    parser.add_argument('--output', help='출력 파일 경로 (preview 모드)')
    parser.add_argument('--config', help='이벤트 설정 JSON 파일 (batch 모드)')
    parser.add_argument('--output-dir', help='출력 디렉토리 (batch 모드)')

    args = parser.parse_args()

    # 검증
    if args.mode == 'preview':
        if not args.text:
            print(json.dumps({'ok': False, 'error': '--text 필수 (preview 모드)'}))
            sys.exit(0)
        if not args.output:
            print(json.dumps({'ok': False, 'error': '--output 필수 (preview 모드)'}))
            sys.exit(0)
    elif args.mode == 'batch':
        if not args.config:
            print(json.dumps({'ok': False, 'error': '--config 필수 (batch 모드)'}))
            sys.exit(0)
        if not args.output_dir:
            print(json.dumps({'ok': False, 'error': '--output-dir 필수 (batch 모드)'}))
            sys.exit(0)

    if args.voice_mode == 'clone' and not args.ref_audio:
        print(json.dumps({'ok': False, 'error': '--ref-audio 필수 (clone 모드)'}))
        sys.exit(0)

    try:
        if args.mode == 'preview':
            run_preview(args)
        else:
            run_batch(args)
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        sys.exit(0)


if __name__ == '__main__':
    main()

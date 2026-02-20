const MESSAGES = {
  ko: {
    'task.complete': '작업이 완료되었습니다!',
    'task.error': '오류가 발생했습니다',
    'input.required': '확인이 필요합니다',
    'session.start': '코딩을 시작합니다',
    'session.end': '세션이 종료되었습니다'
  },
  en: {
    'task.complete': 'Task completed!',
    'task.error': 'Error occurred',
    'input.required': 'Your input is needed',
    'session.start': 'Session started',
    'session.end': 'Session ended'
  }
};

export function getMessage(event, lang = 'ko', customMessages = {}) {
  return customMessages[event] || MESSAGES[lang]?.[event] || MESSAGES.en[event] || event;
}

export function getAllMessages(lang = 'ko') {
  return { ...MESSAGES[lang] };
}

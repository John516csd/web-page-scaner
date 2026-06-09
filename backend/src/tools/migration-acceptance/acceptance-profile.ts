import type { AcceptanceStage, AcceptanceSuite } from './types.js';

export const DEFAULT_GATSBY_URL = 'https://www.notta.ai';
export const DEFAULT_PRODUCTION_URL = 'https://www.notta.ai';

export const STAGE_SUITES: Record<AcceptanceStage, AcceptanceSuite[]> = {
  T0: ['build-readiness'],
  T1: ['smoke', 'routing', 'seo-geo', 'assets'],
  T2: ['cms-storyblok', 'i18n', 'functional-e2e', 'visual-responsive'],
  T3: ['seo-geo', 'performance', 'analytics', 'deploy-monitoring', 'rollback'],
  T4: ['post-launch', 'smoke', 'assets'],
  T5: ['post-launch'],
};

export const DEFAULT_ACCEPTANCE_SUITES: AcceptanceSuite[] = [
  'smoke',
  'routing',
  'seo-geo',
  'assets',
  'page-parity',
  'cms-storyblok',
  'i18n',
  'functional-e2e',
  'visual-responsive',
  'analytics',
  'performance',
];

export const CORE_200_PATHS = ['/', '/en', '/pricing', '/en/pricing', '/blog', '/en/blog', '/features', '/contact'];

export const CMS_SAMPLE_PATHS = [
  '/blog/voice-in-chrome-extension',
  '/en/blog/best-speech-to-text-app',
  '/landing-page/deepseek-ai',
  '/features',
  '/customers',
];

export const SEO_PARITY_PATHS = [
  '/',
  '/en',
  '/de',
  '/pricing',
  '/en/pricing',
  '/blog',
  '/en/blog',
  '/blog/voice-in-chrome-extension',
  '/en/blog/best-speech-to-text-app',
  '/tools/ai-summary',
  '/en/tools/youtube-video-summarizer',
  '/mobile',
  '/en/web',
  '/landing-page/deepseek-ai',
  '/nonexistent-page-qa-check',
];

export const I18N_LANGUAGES = [
  'ja',
  'en',
  'de',
  'fr',
  'es',
  'pt',
  'id',
  'cs',
  'it',
  'nl',
  'pl',
  'tr',
  'uk',
  'ko',
  'ar',
  'fa',
  'th',
  'hi',
  'vi',
];

export const TOOL_FLOW_PATHS = [
  '/tools/ai-summary',
  '/tools/chat-pdf',
  '/tools/pdf-summary',
  '/tools/meeting-agenda',
  '/tools/youtube-video-summarizer',
  '/tools/video-audio-to-blog',
  '/tools/online-audio-converter',
  '/tools/online-video-converter',
];

export const ONLINE_MEDIA_TOOL_PATHS = [
  '/tools/online-audio-converter',
  '/tools/online-video-converter',
  '/tools/online-vocal-remover',
  '/en/tools/online-audio-converter',
  '/en/tools/online-video-converter',
  '/en/tools/online-vocal-remover',
];

export const CTA_PATHS = ['/', '/pricing', '/en/pricing', '/contact'];

export const PERFORMANCE_PATHS = [
  '/',
  '/en',
  '/pricing',
  '/features',
  '/blog/voice-in-chrome-extension',
  '/en/blog/best-speech-to-text-app',
  '/tools/ai-summary',
  '/tools/chat-pdf',
];

export const REQUIRED_EVIDENCE: Array<{ moduleId: string; name: string; owner: string }> = [];

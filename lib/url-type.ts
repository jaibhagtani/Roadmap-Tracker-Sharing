export function detectResourceType(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('github.com')) return 'github';
    if (host.includes('coursera.') || host.includes('udemy.') || host.includes('frontendmasters.')) return 'course';
    if (host.includes('docs.') || host.includes('developer.') || host.includes('learn.microsoft.') || host.includes('developer.mozilla.')) return 'documentation';
    return 'article';
  } catch { return 'other'; }
}

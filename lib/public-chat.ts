export type ChatRecommendation = {
  kind: 'roadmap' | 'resource';
  roadmapId: string;
  roadmapTitle: string;
  title: string;
  description: string;
  url?: string;
  topicId?: string;
  topicTitle?: string;
};

function tokenize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').split(/\s+/).filter(Boolean);
}

export function rankPublicContent(query: string, items: any[], limit = 8): ChatRecommendation[] {
  const q = tokenize(query);
  if (!q.length) return [];
  return items.map(item => {
    const haystack = tokenize([item.title, item.description, item.topicTitle, item.type, item.tags?.join(' ')].filter(Boolean).join(' '));
    let score = 0;
    for (const token of q) {
      if (haystack.includes(token)) score += 5;
      else if (haystack.some((value: string) => value.startsWith(token) || token.startsWith(value))) score += 2;
    }
    if (item.kind === 'roadmap' && tokenize(item.title).some(v => q.includes(v))) score += 3;
    return { item, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.item);
}

export function buildChatReply(query: string, recommendations: ChatRecommendation[]) {
  if (!recommendations.length) {
    return `I couldn't find a matching public roadmap or resource for “${query}”. Try a broader topic such as DSA, system design, React, backend, databases, or DevOps.`;
  }
  const roadmapCount = recommendations.filter(x => x.kind === 'roadmap').length;
  const resourceCount = recommendations.filter(x => x.kind === 'resource').length;
  return `I found ${roadmapCount} public roadmap${roadmapCount === 1 ? '' : 's'} and ${resourceCount} public resource${resourceCount === 1 ? '' : 's'} related to “${query}”. Only publicly visible content is included.`;
}

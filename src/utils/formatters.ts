export function formatOrderStatus(status: string): string {
  switch (status) {
    case 'confirmed':
      return '✅';
    case 'declined':
      return '❌';
    default:
      return '⏳';
  }
}

export function formatCodesMessage(codesToSend: Record<string, string[]>): string {
  let message = '';
  for (const [label, codes] of Object.entries(codesToSend)) {
    const formatted = codes.map(c => `<code>${c}</code>`).join('\n');
    message += `➥ ${label} UC:\n${formatted}\n\n`;
  }
  return message;
}

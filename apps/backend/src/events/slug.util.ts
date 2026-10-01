// Tira acentos, deixa minúsculo, troca qualquer coisa que não seja letra/número
// por hífen, e remove hífens sobrando nas pontas. "Ana & João 2027" vira "ana-joao-2027".
export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Sufixo curto em base36 (letras + números), tipo "x7k2a".
export function randomSuffix(length = 5): string {
  return Math.random().toString(36).slice(2, 2 + length);
}

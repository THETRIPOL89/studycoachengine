/** Prefisso nome esame creato dal tutorial. Non conta nel paywall free. */
export const TUTORIAL_EXAM_PREFIX = '[Tutorial] '

export function isTutorialExamName(nome: string | null | undefined): boolean {
  return typeof nome === 'string' && nome.startsWith(TUTORIAL_EXAM_PREFIX)
}
/**
 * Owner note V3.1 §3: no on-screen line ends with a period ("One more text", not "One more text."). Every component
 * that puts our own words on screen (captions, hook lines, kinetic type, end cards, V2 and V3) calls assertLine(), so a
 * render with a trailing period fails instead of shipping. qa/qa.py then OCRs every QA frame of the encoded MP4 and lists
 * any line on screen that still ends with a period (the app's own UI copy is reported separately in the checklist).
 */
export function assertLine(text: string) {
  if (/\.\s*$/.test(text)) throw new Error(`on-screen line ends with a period: "${text}"`);
  return text;
}

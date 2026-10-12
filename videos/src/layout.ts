/** Where the device frames sit in the video (pure: shared by BeatScene and the check/review scripts). */
export const phoneScreenSize = (height: number) => {
  const screenH = height - 26;
  return { w: (screenH * 390) / 844, h: screenH };
};
/** Browser frame bar height (px). */
export const BAR = 46;
// Horizontal (1920 × 1080): the browser fills the width above the caption band; the phone sits right of centre so the
// bottom-left caption never covers it.
export const DESK = { left: 70, top: 26, w: 1780, h: 878 };
export const PHONE_H = 1012;
export const PHONE_LEFT = 1920 - 110 - 470;
// Vertical (1080 × 1920): a tall browser window, the caption under it; the phone on the right with its title on the left.
export const VDESK = { left: 40, top: 150, w: 1000, h: 1230 };
export const VPHONE_H = 1200;
export const VPHONE_W = phoneScreenSize(VPHONE_H).w + 26;
export const VPHONE_LEFT = 1080 - 50 - VPHONE_W;
/** The Stage's view for a device in a cut. */
export const viewFor = (device: "desktop" | "phone", vertical: boolean) =>
  device === "phone" ? phoneScreenSize(vertical ? VPHONE_H : PHONE_H) : { w: (vertical ? VDESK : DESK).w, h: (vertical ? VDESK : DESK).h - BAR };

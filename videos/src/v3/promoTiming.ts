/** Shared timing for the 20 s promo proof (picture in Promo20.tsx, sound in promoEvents.ts). 108 BPM, origin frame 6. */
export const PROMO_FRAMES = 600;
export const BEAT = 1800 / 108;
export const g = (k: number) => Math.round(6 + k * BEAT); // grid frame of beat k
export const P = {
  aFrom: 94, otsFrom: 172, otsTap: 222, pushFrom: 236, catFrom: 252, tap1: g(17), tap2: g(19), badge: g(21),
  slip: g(22), salmaFrom: 388, stamp: g(26), driverFrom: 476, sent: g(29), morningFrom: 516, morning: g(31), endFrom: 566, logo: g(34),
};

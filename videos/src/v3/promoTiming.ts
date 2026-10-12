/** Shared timing for the 20 s promo proof, Gate F V3.1 (picture in Promo20.tsx, sound in promoEvents.ts).
 * 108 BPM, origin frame 6 (the first chop): g(k) is beat k. Owner notes V3.1 §5: cut density about double the first
 * Gate F proof (19 shots instead of 9), no shot holds longer than one beat without movement, speed ramps on transitions. */
export const PROMO_FRAMES = 600;
export const BEAT = 1800 / 108;
export const g = (k: number) => Math.round(6 + k * BEAT); // grid frame of beat k
export const P = {
  // D "Two hands": three chops (no UI for the first 1.5 s), then each chop is a tap
  chops: [g(0), g(1), g(2)], ui1From: 47, tapA: g(3), chop2From: 64, chop4: g(4), ui2From: 81, tapB: g(5),
  // A "11:04 PM text": snap on beat 8, punch-in on beat 9
  aFrom: 94, snap: g(8), aPunch: g(9),
  // Marco's phone: wide, punch-in, his thumb taps on beat 12, push through the screen, match cut on beat 14
  phoneFrom: 172, phonePunch: g(11), phoneTap: g(12), pushFrom: 222,
  // desktop catalog: one continuous camera, taps on beats 16 and 18, the cart lands "3" on beat 19
  catFrom: g(14), tap1: g(16), tap2: g(18), cart3: g(19),
  // the warehouse: Salma's monitor (real admin), punch-in on beat 21, Confirm on beat 22
  monFrom: g(20), monPunch: g(21), confirm: g(22),
  // inserts: stamp strikes on beat 24, tape pull 26 → pat 27, van door slams on beat 29, SENT on beat 31
  stampFrom: g(23), strike: g(24), tapeFrom: g(26), pat: g(27), vanFrom: g(28), slam: g(29), sentFrom: 498, sent: g(31),
  // end card: logo on beat 32, line 33, button 34, address 35
  endFrom: g(32), logo: g(32),
};

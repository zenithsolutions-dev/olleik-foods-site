# Motion notes (V3, Gate E)

Status: Pending Review. One page of techniques we borrow, each with what exactly we do in the Olleik films and where it came from.
Sources were researched on 2026-10-11; **[F]** = page fetched and read, **[S]** = seen in search results only. Where no first-party
making-of exists (Apple, Stripe, Linear, Cash App publish almost none), the technique is described from what is on screen or
from a third-party analysis, and marked as our inference.

## 1. Long-take UI travel ("one page, one world")
- **Every shot is a camera move over the real product, one action at a time; every transition is done by the camera.**
  Lago's teardown of Linear-style launch films: zoom into the action, whip between screens, hold on the payoff; screens bleed
  off frame instead of floating as cards; each shot names where the eye must land and has a minimum "reading hold".
  [getlago.com/blog/we-killed-our-motion-design-job](https://getlago.com/blog/we-killed-our-motion-design-job) [F]
  - **What we do.**
    - One continuous camera per page, driven by keyframes `{t, cx, cy, zoom, ease}`.
    - Each keyframe carries an `eye` target, and the engine checks that the target is in frame at arrival.
    - Each tap is followed by a hold of at least 12 frames (0.4 s) on its result.
    - The page fills the frame edge to edge, never a floating browser card.
- **Progress is a pure function of time.** Apple's scroll films map scroll progress to a frame index
  (`Math.floor(scrollFraction * frameCount)`).
  [css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/) [F]
  - **What we do.** The camera path is a deterministic function of the frame, with no simulation state. Any frame can therefore
    be rendered alone, and the QA tools can sample anchors frame by frame.
- **Status changes patch only the region that changed.** This is Lago again: a chip flips in place, it isn't re-shot.
  - **What we do.** Each tap swaps only the changed rectangle (button → "1 in cart", cart badge), cut from the real
    after-tap capture, with a press and a spring. The camera does not cut.

## 2. Eased dollies with motion blur, never a jump
- **Shutter-angle camera blur.** Remotion's `CameraMotionBlur` averages sub-frame samples, `shutterAngle` 180° is the film
  norm, and 5–10 samples are enough.
  [remotion.dev/docs/motion-blur/camera-motion-blur](https://remotion.dev/docs/motion-blur/camera-motion-blur) [F]
  - **What we do.** We use our own camera-only version: the page layers are re-rendered at sub-frame camera positions across a
    180° shutter, with 1 sample when the camera is still and up to 8 at speed. Blur therefore follows real velocity, and still
    frames stay razor sharp. Only the camera is sampled, not the whole tree, so the cost stays bounded.
- **Speed ramps.** In the After Effects graph editor, steep means fast and flat means slow; ease out of a fast move into a hold.
  [schoolofmotion.com/tutorials/intro-to-the-graph-editor-in-after-effects](https://www.schoolofmotion.com/tutorials/intro-to-the-graph-editor-in-after-effects/) [S]
  - **What we do.** Travel uses an asymmetric "arrive" curve, a fast start and a long settle (cubic-bezier 0.16, 1, 0.3, 1).
    Big moves between regions use a symmetric in-out with a short peak. Zoom is interpolated in log space, so push-ins feel
    linear to the eye.
- **Zoom rules (our own, from feedback 3).**
  - The camera never shows a capture above its native 3x density. The engine asserts `outputPxPerCssPx ≤ 3`.
  - Zoom is capped at 1.6x of the full-width framing.
  - At least one structural anchor (nav, page title, search, cart) stays inside the frame on every frame; a validator fails
    the render if not.

## 3. Parallax layers (2.5D)
- **Split the flat image into depth layers.** More z-gap gives stronger parallax, with the foreground nearest the camera;
  push in slowly. [blog.motionarray.com/learn/after-effects/animate-flat-2d-images-after-effects](https://blog.motionarray.com/learn/after-effects/animate-flat-2d-images-after-effects/) [F]
  - **What we do.** Four layers per page, all from real captures, none redrawn:
    - **L0, the page plate.** The page captured with its cards hidden.
    - **L1, cards.** Cut from the full capture by their measured boxes.
    - **L2, chips and badges** (status chips, cart badge, "in cart" stepper).
    - **L3, cursor or finger.**
  - Each layer moves by `(camera − layerHome) × p`, with p = 0, 0.035, 0.07 and 0.12. At its home position every layer lands
    exactly on the plate, so a still frame equals the real screenshot.
  - Raised layers get a soft shadow that grows with p.

## 4. Taps react in the shot (anticipation, follow-through)
- **Disney principles applied to UI.** Anticipation before an action, follow-through and overlap with offset timing,
  slow-in/slow-out, and staging with minimal secondary motion.
  [ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design](https://ixdf.org/literature/article/ui-animation-how-to-apply-disney-s-12-principles-of-animation-to-ui-design) [F]
  - **Each tap is a 5-part beat:**
    1. The cursor arrives early and slows down (anticipation).
    2. A 3-frame press: scale 0.96 and a darker shadow.
    3. The button region swaps to the after-tap state with a spring overshoot (1.04 → 1).
    4. A ring ripple.
    5. Six frames later, the result lands somewhere else (the cart badge bumps 1 → 1.35 → 1). The camera has already started
       to drift toward that badge, so the eye is pulled along.
- **The action triggers the payoff in the same shot.** In Cash App's "Give In To Glitter", paying with the card sets off the
  glitter on the hand. [adsoftheworld.com/campaigns/give-in-to-glitter](https://www.adsoftheworld.com/campaigns/give-in-to-glitter) [F]
  - **What we do.** The SENT and CONFIRMED moments are physical reactions on the real UI (stamp, slip), not a new scene.

## 5. Kinetic type bound to UI
- **Type has two modes.** Config 2025 uses expressive type (slower build, personality) and functional type (quick, direct).
  Glyph motions ripple through the layout.
  [figma.com/blog/how-we-shaped-the-visual-identity-for-config-2025](https://www.figma.com/blog/how-we-shaped-the-visual-identity-for-config-2025/) [F]
  - **What we do.** Story lines use expressive type; captions in the manuals use functional type. Story lines are anchored to
    a UI element's box in page coordinates, so they travel with the camera and the parallax. They never sit in a fixed screen
    corner, and the marker callouts follow the same rule.
- **Object-to-UI morphs.** In the Config 2024 opener, basic shapes trigger each other and grow into full forms.
  [itsnicethat.com/features/figma-config-2024-identity-graphic-design-spotlight-090724](https://www.itsnicethat.com/features/figma-config-2024-identity-graphic-design-spotlight-090724) [F]
  - **What we do.**
    - In hook C, a paper slip lands flat and becomes the order screen.
    - In hook E, the sticky notes peel away into the catalog grid.
    - In the hero, the catalog photo of the tomatoes becomes the real tomatoes.

## 6. Motivated cuts only
- **Whip pan.** Both halves pan the same direction at matched speed, the join is hidden in the blur, and a whoosh sells it.
  [studiobinder.com/blog/swish-pan-whip-pan-definition-film](https://www.studiobinder.com/blog/swish-pan-whip-pan-definition-film/) [F]
  - **What we do.** Cuts happen only at story beats: a page change, a location change or a time change. Each one is
    motivated by:
    - a whip pan (the camera exits at speed, enters the next page at the same speed and direction);
    - a match cut on a shape (a slip becomes the order card, a box becomes the box);
    - a light change (night to morning);
    - a hand or box passing the lens.

## 7. Hooks: pattern interrupt in 1.5 s, works on mute
- **Pattern interrupts.**
  - Segwise's frame-by-frame study of top ads (vendor data, directional only) found:
    - about 1.5 s to survive the scroll;
    - must work on mute;
    - a cut every 2–3 s after the hook;
    - visual interrupts such as a reverse drop or a prop peeled away.
    [segwise.ai/blog/anatomy-top-performing-video-ad-frame-by-frame](https://segwise.ai/blog/anatomy-top-performing-video-ad-frame-by-frame) [F]
  - Duolingo's "dead Duo" grew from one visible change.
    [thedrum.com … duolingo-s-tiktok-mastermind](https://www.thedrum.com/news/2025/02/25/duolingo-s-tiktok-mastermind-its-unhinged-social-strategy-and-killing-its-mascot) [F]
  - Google's ABCDs: attract, brand, connect, direct.
    [thinkwithgoogle.com … guidelines-great-creative](https://www.thinkwithgoogle.com/intl/en-gb/marketing-strategies/video/guidelines-great-creative) [S]
  - **What we do.**
    - The first 1.5 s of every film has no logo and no UI: one sound and one picture that raise a question.
    - The hook's snap point starts the 108 BPM grid.
    - Every hook is checked on mute, and its picture must read without sound.
    - We do not cite the often-repeated "71 % decide in 3 s" figure; no primary source was found.

## 8. Rhythm (feedback 7)
- **Decision: rhythm-led.** The cut and every UI reaction sit on a 108 BPM grid (one beat = 16.667 frames at 30 fps; a tap
  lands on a beat or an off-beat eighth).
  - The pulse is built from the story's own recorded sounds: chop, tap, stamp, printer, box thud.
  - A music bed may sit under the pulse from the snap point to the end card.
  - Original audio rather than trending tracks (Duolingo's practice, The Drum above).
  - Figma's Config 2025 frame-rate drop to 15 fps for a "handmade" feel is noted but not used. Our UI must stay smooth to read.

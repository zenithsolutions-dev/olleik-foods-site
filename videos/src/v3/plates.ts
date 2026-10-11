/** Plate states of a world shot (no remotion or font imports, so node tools can bundle the sound events). */
export type PlateState = [number, string] | [number, string, number]; // [fromFrame, capture, fade frames]
export const states = (plate: string | PlateState[]): PlateState[] => (typeof plate === "string" ? [[0, plate]] : plate);
/** Frames where the plate changes state (sound design: a soft UI tick on each real update). */
export const plateChanges = (shot: { plate: string | PlateState[] }) => states(shot.plate).slice(1).map((s) => s[0]);

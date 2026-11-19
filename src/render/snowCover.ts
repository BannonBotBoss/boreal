/**
 * Snow the ground paints and the HUD prints.
 * The planet snow plane can hold a thin residual while the landing is a green
 * forest floor (a filmed run read 10.5 cm on moss, with the white in the clouds
 * during the drop). A cover you can see starts at 15 cm. Below that the floor
 * stays litter and the number is 0, so the two agree.
 */
export const SNOW_VISIBLE_CM = 15;

export function snowOnGroundCm(depthCm: number) {
  if (!(depthCm >= SNOW_VISIBLE_CM)) return 0;
  return depthCm;
}

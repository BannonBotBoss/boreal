/**
 * Orbit light on top of the world-file shaders. Those files are at the
 * simulation ceiling, so the twilight gate, the cloud-white mix, and the
 * clear-sky ocean (no silver mirror) live here and are applied as the
 * material compiles.
 *
 * Twilight: civil twilight is the sun's centre 6° below the horizon
 * (Seidelmann, ed., 1992, Explanatory Supplement to the Astronomical Almanac).
 * By 8° the surface sun on AS17-148-22727 is white again.
 */
export const TWILIGHT = { innerDeg: 6, outerDeg: 8 };

const WARM = `vec3 atmWarmSun(vec3 sunT, float mu) {
  float elev = degrees(asin(clamp(mu, -1.0, 1.0)));
  float band = 1.0 - smoothstep(${TWILIGHT.innerDeg.toFixed(1)}, ${TWILIGHT.outerDeg.toFixed(1)}, abs(elev));
  return mix(vec3(1.0), sunT, band);
}`;

/** Replace the wide peach terminator and keep orbit clouds neutral. */
export function orbitAtmosphere(src: string) {
  let out = src.replace(/vec3 atmWarmSun\(vec3 sunT, float mu\) \{[\s\S]*?\n\}/, WARM);
  out = out.replace(
    'float cs = 1.0 - 0.96 * coverS;',
    'float cs = 1.0 - 0.96 * coverS * (1.0 - clamp(uOrbit, 0.0, 1.0));',
  );
  out = out.replace(
    'float csSpec = 1.0 - smoothstep(0.08, 0.35, coverS);',
    'float csSpec = 1.0 - smoothstep(0.08, 0.35, coverS); csSpec *= (1.0 - cloudDeck);',
  );
  out = out.replace(
    '(reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular) * skyF + totalEmissiveRadiance;',
    '(reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular) * skyF * mix(1.0, 0.22, clamp(uOrbit, 0.0, 1.0)) + totalEmissiveRadiance;',
  );
  out = out.replace(
    'outgoingLight += atmEmission(rd, d) * ATM_AERIAL; }',
    'outgoingLight += atmEmission(rd, d) * ATM_AERIAL; if (cloudDeck > 0.12) { float cy = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)); outgoingLight = mix(outgoingLight, vec3(cy), smoothstep(0.12, 0.55, cloudDeck)); } }',
  );
  return out;
}

/**
 * Clear-sky orbit water was a silver mirror: a bright sky reflectionColor,
 * a smooth uOceanRough, and uOceanMetal. At orbit the reflection stays the
 * dark water colour, the sea is rough, and metalness is 0. A cloud deck
 * still removes the glint (glintGate) without falling back onto the lake roughness.
 */
export function orbitWater(src: string) {
  let out = src.replace(
    'vec3 reflectionColor = mix(vec3(0.02, 0.035, 0.07), vec3(0.62, 0.76, 0.94), clamp(atmSkyF(dot(normal, uSun)), 0.0, 1.0));',
    'vec3 reflectionColor = mix(vec3(0.02, 0.035, 0.07), vec3(0.62, 0.76, 0.94), clamp(atmSkyF(dot(normal, uSun)), 0.0, 1.0) * (1.0 - clamp(uOrbit, 0.0, 1.0)));',
  );
  out = out.replace(
    'oceanGlint = (1.0 - landMask) * (1.0 - clamp(vLake, 0.0, 1.0)) * uOceanGlint * presentW;\nroughnessFactor = mix(roughnessFactor, uOceanRough, oceanGlint); // Matthew 2026-11-06: 0.15-0.2 on the ocean\nroughnessFactor = mix(roughnessFactor, uLakeRough, (1.0 - landMask) * (1.0 - oceanGlint)); // lakes, and the ocean when the tier drops the glint: Cox-Munk',
    `float oceanHere = (1.0 - landMask) * (1.0 - clamp(vLake, 0.0, 1.0));
float lakeHere = (1.0 - landMask) * clamp(vLake, 0.0, 1.0);
float glintGate = (1.0 - cloudDeck);
oceanGlint = oceanHere * uOceanGlint * presentW * glintGate;
roughnessFactor = mix(roughnessFactor, max(uOceanRough, 0.62), oceanHere * clamp(uOrbit, 0.0, 1.0));
roughnessFactor = mix(roughnessFactor, uOceanRough, oceanHere * (1.0 - clamp(uOrbit, 0.0, 1.0)));
roughnessFactor = mix(roughnessFactor, uLakeRough, lakeHere);`,
  );
  out = out.replace(
    'metalnessFactor = mix(metalnessFactor, uOceanMetal, oceanGlint);',
    'metalnessFactor = mix(metalnessFactor, uOceanMetal * (1.0 - clamp(uOrbit, 0.0, 1.0)), oceanHere * glintGate);',
  );
  return out;
}

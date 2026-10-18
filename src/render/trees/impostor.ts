/**
 * Octahedral impostors for the farthest tree ring (Brucks 2018 "Octahedral Impostors"; Max & Ohsaki 1995). Tailored copy
 * (Grok Bot) of agargaro/octahedral-impostor (MIT, @ca0046a; unmodified baseline in vendor/octahedral-impostor): the
 * hemi-octahedron atlas bake (albedo + packed normal/depth MRT) and the 3-sprite blend shader, unchanged. Changes: shaders
 * inlined as strings (no .glsl loader), only the material paths our trees use (map, alphaTest, vertexColors), the bake
 * restores renderer state including clear colour/tone mapping, and InstancedMesh is the only mesh path (one draw call per
 * baked variant).
 */
import * as THREE from 'three';
import { MIP_ALPHA } from './conifer';

const ATLAS_VERT = `// got by merging basic, normal, depth material 
#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex> 
#include <normal_pars_vertex> 
#include <color_pars_vertex>
// #include <morphtarget_pars_vertex>
// #include <skinning_pars_vertex>
varying vec2 vHighPrecisionZW;

void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
// 	#include <morphinstance_vertex>
// 	#include <morphcolor_vertex>
// 	#include <morphnormal_vertex>
// 	#include <skinbase_vertex>
// 	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
    #include <normal_vertex>
	#include <begin_vertex>
// 	#include <morphtarget_vertex>
// 	#include <skinning_vertex>
    #include <displacementmap_vertex>
	#include <project_vertex>
	
    vHighPrecisionZW = gl_Position.zw;

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`;
const ATLAS_FRAG = `#define NORMAL
uniform vec3 diffuse;
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
varying vec2 vHighPrecisionZW;

layout(location = 0) out vec4 gAlbedo;
layout(location = 1) out vec4 gNormalDepth;

void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	if (diffuseColor.a <= 0.2) { // TODO custom code
		discard;
	}

	// #include <opaque_fragment>
    #ifdef OPAQUE
		diffuseColor.a = 1.0;
	#endif
	#ifdef USE_TRANSMISSION
		diffuseColor.a *= material.transmissionAlpha;
	#endif
	gAlbedo = diffuseColor;

	// // #include <colorspace_fragment>
	gAlbedo = linearToOutputTexel( gAlbedo );

	// // #include <premultiplied_alpha_fragment>
    #ifdef PREMULTIPLIED_ALPHA
		gAlbedo.rgb *= gAlbedo.a;
	#endif

	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	gNormalDepth = vec4( packNormalToRGB( normal ), 1.0 - fragCoordZ );
}`;
const P_VERT = `#include <clipping_planes_pars_vertex>

uniform mat4 impostorTransform;
uniform float spritesPerSide;

flat varying vec4 vSpritesWeight;
flat varying vec2 vSprite1;
flat varying vec2 vSprite2;
flat varying vec2 vSprite3;
varying vec2 vSpriteUV1;
varying vec2 vSpriteUV2;
varying vec2 vSpriteUV3;
// varying vec2 vSpriteViewDir1;
// varying vec2 vSpriteViewDir2;
// varying vec2 vSpriteViewDir3;

// #ifdef EZ_USE_NORMAL
// flat varying vec3 vSpriteNormal1;
// flat varying vec3 vSpriteNormal2;
// flat varying vec3 vSpriteNormal3;
// #endif

vec2 encodeDirection(vec3 direction) {
  #ifdef EZ_USE_HEMI_OCTAHEDRON

  vec3 octahedron = direction / dot(direction, sign(direction));
  return vec2(1.0 + octahedron.x + octahedron.z, 1.0 + octahedron.z - octahedron.x) * 0.5;

  #else

  // TODO: Implement full octahedral encoding

  #endif
}

vec3 decodeDirection(vec2 gridIndex, vec2 spriteCountMinusOne) {
  vec2 gridUV = gridIndex / spriteCountMinusOne;

  #ifdef EZ_USE_HEMI_OCTAHEDRON

  vec3 position = vec3(gridUV.x - gridUV.y, 0.0, -1.0 + gridUV.x + gridUV.y);
  position.y = 1.0 - abs(position.x) - abs(position.z);

  #else

    // TODO: Implement full octahedral decoding

  #endif

  return normalize(position);
}

void computePlaneBasis(vec3 normal, out vec3 tangent, out vec3 bitangent) {
  vec3 up = vec3(0.0, 1.0, 0.0);

  if(normal.y > 0.999)
    up = vec3(-1.0, 0.0, 0.0);

  #ifndef EZ_USE_HEMI_OCTAHEDRON
  if(normal.y < -0.999)
    up = vec3(1.0, 0.0, 0.0);
  #endif

  tangent = normalize(cross(up, normal));
  bitangent = cross(normal, tangent);
}

vec3 projectVertex(vec3 normal) {
  vec3 x, y;
  computePlaneBasis(normal, x, y);
  return x * position.x + y * position.y;
}

void computeSpritesWeight(vec2 gridFract) {
  vSpritesWeight = vec4(min(1.0 - gridFract.x, 1.0 - gridFract.y), abs(gridFract.x - gridFract.y), min(gridFract.x, gridFract.y), ceil(gridFract.x - gridFract.y));
}

vec2 projectToPlaneUV(vec3 normal, vec3 tangent, vec3 bitangent, vec3 cameraPosition, vec3 viewDir) {
  float denom = dot(viewDir, normal);
  
  // // Avoid division by zero when view direction is parallel to plane
  // if (abs(denom) < 1e-6) {
  //   return vec2(0.5); // Return center UV as fallback
  // }
  
  float t = -dot(cameraPosition, normal) / denom;

  vec3 hit = cameraPosition + viewDir * t;
  vec2 uv = vec2(dot(tangent, hit), dot(bitangent, hit));
  return uv + 0.5;
}

vec3 projectDirectionToBasis(vec3 dir, vec3 normal, vec3 tangent, vec3 bitangent) {
  return vec3(dot(dir, tangent), dot(dir, bitangent), dot(dir, normal));
}
`;
const VERT = `// #include <project_vertex>

vec2 spritesMinusOne = vec2(spritesPerSide - 1.0);

#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT
mat4 transformedInstanceMatrix = instanceMatrix * impostorTransform;
vec3 cameraPosLocal = (inverse(transformedInstanceMatrix * modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
#else
vec3 cameraPosLocal = (inverse(impostorTransform * modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
#endif

vec3 cameraDir = normalize(cameraPosLocal);

vec3 projectedVertex = projectVertex(cameraDir);
vec3 viewDirLocal = normalize(projectedVertex - cameraPosLocal);

vec2 grid = encodeDirection(cameraDir) * spritesMinusOne;
vec2 gridFloor = min(floor(grid), spritesMinusOne);

vec2 gridFract = fract(grid);

computeSpritesWeight(gridFract);

vSprite1 = gridFloor;
vSprite2 = min(vSprite1 + mix(vec2(0.0, 1.0), vec2(1.0, 0.0), vSpritesWeight.w), spritesMinusOne);
vSprite3 = min(vSprite1 + vec2(1.0), spritesMinusOne);

vec3 spriteNormal1 = decodeDirection(vSprite1, spritesMinusOne);
vec3 spriteNormal2 = decodeDirection(vSprite2, spritesMinusOne);
vec3 spriteNormal3 = decodeDirection(vSprite3, spritesMinusOne);

// #ifdef EZ_USE_NORMAL
// vSpriteNormal1 = spriteNormal1;
// vSpriteNormal2 = spriteNormal2;
// vSpriteNormal3 = spriteNormal3;
// #endif

vec3 planeX1, planeY1, planeX2, planeY2, planeX3, planeY3;
computePlaneBasis(spriteNormal1, planeX1, planeY1);
computePlaneBasis(spriteNormal2, planeX2, planeY2);
computePlaneBasis(spriteNormal3, planeX3, planeY3);

vSpriteUV1 = projectToPlaneUV(spriteNormal1, planeX1, planeY1, cameraPosLocal, viewDirLocal);
vSpriteUV2 = projectToPlaneUV(spriteNormal2, planeX2, planeY2, cameraPosLocal, viewDirLocal);
vSpriteUV3 = projectToPlaneUV(spriteNormal3, planeX3, planeY3, cameraPosLocal, viewDirLocal);

// vSpriteViewDir1 = projectDirectionToBasis(-viewDirLocal, spriteNormal1, planeX1, planeY1).xy;
// vSpriteViewDir2 = projectDirectionToBasis(-viewDirLocal, spriteNormal2, planeX2, planeY2).xy;
// vSpriteViewDir3 = projectDirectionToBasis(-viewDirLocal, spriteNormal3, planeX3, planeY3).xy;

vec4 mvPosition = vec4(projectedVertex, 1.0);

#if defined USE_INSTANCING || defined USE_INSTANCING_INDIRECT
    mvPosition = transformedInstanceMatrix * mvPosition;
# else
    mvPosition = impostorTransform * mvPosition;
#endif

mvPosition = modelViewMatrix * mvPosition;

gl_Position = projectionMatrix * mvPosition;
`;
const P_FRAG = `#include <clipping_planes_pars_fragment>

uniform float spritesPerSide;
// uniform float parallaxScale;
uniform float alphaClamp;

#ifdef EZ_USE_ORM
uniform sampler2D ormMap;
#endif

flat varying vec4 vSpritesWeight;
flat varying vec2 vSprite1;
flat varying vec2 vSprite2;
flat varying vec2 vSprite3;
varying vec2 vSpriteUV1;
varying vec2 vSpriteUV2;
varying vec2 vSpriteUV3;
// varying vec2 vSpriteViewDir1;
// varying vec2 vSpriteViewDir2;
// varying vec2 vSpriteViewDir3;

// #ifdef EZ_USE_NORMAL
// flat varying vec3 vSpriteNormal1;
// flat varying vec3 vSpriteNormal2;
// flat varying vec3 vSpriteNormal3;
// #endif

#ifdef EZ_USE_NORMAL
vec3 blendNormals(vec2 uv1, vec2 uv2, vec2 uv3) {
  vec3 normalDepth1 = unpackRGBToNormal(texture2D(normalMap, uv1).rgb); // we're reading twice if parallax enabled
  vec3 normalDepth2 = unpackRGBToNormal(texture2D(normalMap, uv2).rgb);
  vec3 normalDepth3 = unpackRGBToNormal(texture2D(normalMap, uv3).rgb);

  // Fix normal if blended bad

  return normalize(normalDepth1.xyz * vSpritesWeight.x + normalDepth2.xyz * vSpritesWeight.y + normalDepth3.xyz * vSpritesWeight.z);
}
#endif

// // temporaly removed
// vec2 parallaxUV(vec2 uv_f, vec2 frame, vec2 xy_f, float frame_size, float weight) {
//   // vec2 spriteUv = frame_size * (frame + uv_f);
//   // float depth = texture(normalMap, spriteUv).a;
//   // vec2 parallaxOffset = xy_f * depth * parallaxScale; // * weight;
//   // uv_f = clamp(uv_f + parallaxOffset, vec2(0.0), vec2(1.0));
//   // return frame_size * (frame + uv_f);

//   uv_f = clamp(uv_f, vec2(0), vec2(1));
// 	vec2 uv_quad = frame_size * (frame + uv_f);
//   float n_depth = max(0.0, 0.5 - texture(normalMap, uv_quad).a);

//   uv_f = xy_f * n_depth * parallaxScale * (1.0 - weight) + uv_f;
// 	uv_f = clamp(uv_f, vec2(0), vec2(1));
// 	uv_f =  frame_size * (frame + uv_f);
// 	return clamp(uv_f, vec2(0), vec2(1));
// }

vec2 getUV(vec2 uv_f, vec2 frame, float frame_size) {
  uv_f = clamp(uv_f, vec2(0), vec2(1));
	vec2 uv_quad = frame_size * (frame + uv_f);
	uv_f =  frame_size * (frame + uv_f);
	return clamp(uv_f, vec2(0), vec2(1));
}
`;
const MAP_FRAG = `//#include <map_fragment>
float spriteSize = 1.0 / spritesPerSide;

// disable it for now
// vec2 uv1 = parallaxUV(vSpriteUV1, vSprite1, vSpriteViewDir1, spriteSize, vSpritesWeight.x);
// vec2 uv2 = parallaxUV(vSpriteUV2, vSprite2, vSpriteViewDir2, spriteSize, vSpritesWeight.y);
// vec2 uv3 = parallaxUV(vSpriteUV3, vSprite3, vSpriteViewDir3, spriteSize, vSpritesWeight.z);

// todo remove if we want parallax
vec2 uv1 = getUV(vSpriteUV1, vSprite1, spriteSize);
vec2 uv2 = getUV(vSpriteUV2, vSprite2, spriteSize);
vec2 uv3 = getUV(vSpriteUV3, vSprite3, spriteSize);

vec4 sprite1, sprite2, sprite3;
float test = 1.0 - alphaClamp;

if (vSpritesWeight.x >=  test) {

  sprite1 = texture(map, uv1);
  if (sprite1.a <= alphaClamp) discard;

  sprite2 = texture(map, uv2);
  sprite3 = texture(map, uv3);

} else if (vSpritesWeight.y >=  test) {

  sprite2 = texture(map, uv2);
  if (sprite2.a <= alphaClamp) discard;

  sprite1 = texture(map, uv1);
  sprite3 = texture(map, uv3);

} else if (vSpritesWeight.z >=  test) {

  sprite3 = texture(map, uv3);
  if (sprite3.a <= alphaClamp) discard;

  sprite1 = texture(map, uv1);
  sprite2 = texture(map, uv2);

} else {

  sprite1 = texture(map, uv1);
  sprite2 = texture(map, uv2);
  sprite3 = texture(map, uv3);

}

vec4 blendedColor = sprite1 * vSpritesWeight.x + sprite2 * vSpritesWeight.y + sprite3 * vSpritesWeight.z;

if (blendedColor.a <= alphaClamp) discard;

#ifndef EZ_TRANSPARENT
blendedColor = vec4(vec3(blendedColor.rgb) / blendedColor.a, 1.0);
#endif

// diffuseColor *= blendedColor;
`;
const NRM_FRAG = `// #include <normal_fragment_begin>
vec3 normal = blendNormals(uv1, uv2, uv3);
vec3 nonPerturbedNormal = normal;
`;

export interface Atlas { target: THREE.WebGLRenderTarget; albedo: THREE.Texture; normalDepth: THREE.Texture; transform: THREE.Matrix4 }
const cam = new THREE.OrthographicCamera(), sphere = new THREE.Sphere(), tmp = new THREE.Sphere();
function boundingSphere(obj: THREE.Object3D, out: THREE.Sphere) {
  out.makeEmpty(); obj.updateMatrixWorld(true);
  obj.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.geometry.computeBoundingSphere(); tmp.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld); out.union(tmp); });
  return out;
}
/** hemiOctaGridToDir (upstream utils/octahedronUtils.ts) */
const hemiDir = (x: number, y: number, t: THREE.Vector3) => { t.set(x - y, 0, -1 + x + y); t.y = 1 - Math.abs(t.x) - Math.abs(t.z); return t; };
function bakeMaterial(src: THREE.MeshStandardMaterial) {
  const uniforms: Record<string, THREE.IUniform> = { diffuse: { value: src.color }, opacity: { value: src.opacity } };
  if (src.alphaTest > 0) uniforms.alphaTest = { value: src.alphaTest };
  if (src.map) { uniforms.map = { value: src.map }; uniforms.mapTransform = { value: src.map.matrix }; }
  const m = new THREE.ShaderMaterial({ uniforms, defines: src.map ? { USE_UV: '' } : {}, vertexShader: ATLAS_VERT, fragmentShader: ATLAS_FRAG, glslVersion: THREE.GLSL3, side: src.side, vertexColors: src.vertexColors });
  m.onBeforeCompile = s => { const p = s as unknown as Record<string, unknown>; if (src.map) { p.map = true; p.mapUv = 'uv'; } p.alphaTest = src.alphaTest > 0; s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', MIP_ALPHA); };
  return m;
}
/** Bake `target` from spritesPerSide² directions of the upper hemisphere into a size² atlas (2 render targets). */
export function bakeAtlas(renderer: THREE.WebGLRenderer, target: THREE.Object3D, size = 1024, spritesPerSide = 8): Atlas {
  boundingSphere(target, sphere);
  cam.left = -sphere.radius; cam.right = sphere.radius; cam.top = sphere.radius; cam.bottom = -sphere.radius; cam.zoom = 1; cam.near = .001; cam.far = sphere.radius * 2 + .001; cam.updateProjectionMatrix();
  const old = { rt: renderer.getRenderTarget(), pr: renderer.getPixelRatio(), sc: renderer.getScissorTest(), ca: renderer.getClearAlpha(), cc: renderer.getClearColor(new THREE.Color()), vp: renderer.getViewport(new THREE.Vector4()), ss: renderer.getScissor(new THREE.Vector4()), tm: renderer.toneMapping };
  const rt = new THREE.WebGLRenderTarget(size, size, { count: 2, generateMipmaps: true });
  rt.textures[0].minFilter = THREE.LinearMipmapLinearFilter; rt.textures[0].magFilter = THREE.LinearFilter; rt.textures[0].colorSpace = THREE.SRGBColorSpace; // dark foliage albedo needs sRGB precision in 8 bits (upstream: linear)
  rt.textures[1].minFilter = THREE.NearestMipmapNearestFilter; rt.textures[1].magFilter = THREE.NearestFilter; rt.textures[1].colorSpace = THREE.LinearSRGBColorSpace;
  renderer.setRenderTarget(rt); renderer.setScissorTest(true); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping; renderer.clear();
  const saved = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  target.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { saved.set(m, m.material); m.material = bakeMaterial(m.material as THREE.MeshStandardMaterial); } });
  const n1 = spritesPerSide - 1, cell = size / spritesPerSide;
  for (let row = 0; row < spritesPerSide; row++) for (let col = 0; col < spritesPerSide; col++) {
    hemiDir(col / n1, row / n1, cam.position); cam.position.setLength(sphere.radius).add(sphere.center); cam.lookAt(sphere.center);
    renderer.setViewport(col * cell, row * cell, cell, cell); renderer.setScissor(col * cell, row * cell, cell, cell); renderer.render(target, cam);
  }
  for (const [m, mat] of saved) { (m.material as THREE.Material).dispose(); m.material = mat; }
  renderer.setRenderTarget(old.rt); renderer.setScissorTest(old.sc); renderer.setViewport(old.vp); renderer.setScissor(old.ss); renderer.setPixelRatio(old.pr); renderer.setClearColor(old.cc, old.ca); renderer.toneMapping = old.tm;
  const s = sphere.radius * 2, transform = new THREE.Matrix4().makeScale(s, s, s).setPosition(sphere.center);
  return { target: rt, albedo: rt.textures[0], normalDepth: rt.textures[1], transform };
}
/** Baked-normal weight (0 = camera-facing normal). Upstream marks its baked normals TODO; .25 keeps the near LOD's soft crown
 *  shading in the viewer [game calibration]. */
export const IMPOSTOR_FX = { normalMix: { value: .25 }, upBend: { value: .15 } }; // upBend: the camera-facing normal bent toward world up (the near LOD's crown normals lean up); .15 matches the near LOD's rendered brightness in the viewer [game calibration]
/** Impostor material over MeshStandardMaterial (upstream createOctahedralImpostorMaterial, hemi + normal, opaque). */
export function impostorMaterial(atlas: Atlas, spritesPerSide = 8, alphaClamp = .4) {
  const m = new THREE.MeshStandardMaterial({ roughness: .85 }); m.userData.shared = true;
  (m as unknown as { map: THREE.Texture }).map = atlas.albedo; m.normalMap = atlas.normalDepth;
  const u = { uNormalMix: IMPOSTOR_FX.normalMix, uUpBend: IMPOSTOR_FX.upBend, spritesPerSide: { value: spritesPerSide }, alphaClamp: { value: alphaClamp }, impostorTransform: { value: atlas.transform } };
  m.onBeforeCompile = s => {
    s.defines = { ...s.defines, EZ_USE_HEMI_OCTAHEDRON: true, EZ_USE_NORMAL: true }; Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace('#include <clipping_planes_pars_vertex>', P_VERT).replace('#include <project_vertex>', VERT);
    s.fragmentShader = 'uniform float uNormalMix; uniform float uUpBend;\n' + s.fragmentShader.replace('#include <map_fragment>', 'diffuseColor *= blendedColor;') // first, or it would hit the commented include inside MAP_FRAG (upstream order)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `${MAP_FRAG}\n vec4 diffuseColor = vec4( diffuse, opacity );`)
      .replace('#include <clipping_planes_pars_fragment>', P_FRAG).replace('#include <normal_fragment_begin>', NRM_FRAG + '\nnormal = normalize(mix(normalize(vec3(0., 0., 1.) + uUpBend * (viewMatrix * vec4(0., 1., 0., 0.)).xyz), normal, uNormalMix)); nonPerturbedNormal = normal;')
      .replace('#include <normal_fragment_maps>', '');
  };
  m.customProgramCacheKey = () => 'boreal-tree-impostor-v1';
  return m;
}
/** One InstancedMesh of impostors (PlaneGeometry, oriented in the shader); `count` capacity. */
export function impostorMesh(atlas: Atlas, count: number, spritesPerSide = 8) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(), impostorMaterial(atlas, spritesPerSide), count);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; return mesh;
}

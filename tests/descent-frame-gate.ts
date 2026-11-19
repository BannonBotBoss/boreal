/**
 * The SwiftShader stall capture peaks at 477 ms and the streamed capture at
 * 96.9 ms. A 500 ms gate lets the stall pass. 250 ms fails that capture and
 * passes the streamed one.
 */
export const DIVE_FRAME_MS = 250;

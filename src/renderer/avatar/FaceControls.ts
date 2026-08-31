/* ------------------------------------------------------------------ */
/* FaceControls — per-side facial expression controls, the controls -> */
/* morph mapping, and the expression/blink controllers (milestone 6).  */
/* ------------------------------------------------------------------ */

export interface FaceControls {
  smileLeft: number;
  smileRight: number;

  frownLeft: number;
  frownRight: number;

  blinkLeft: number;
  blinkRight: number;

  browUpLeft: number;
  browUpRight: number;

  browDownLeft: number;
  browDownRight: number;

  jawOpen: number;
  jawForward: number;

  mouthOpen: number;
  mouthPucker: number;

  cheekRaiseLeft: number;
  cheekRaiseRight: number;

  noseWrinkle: number;

  squintLeft: number;
  squintRight: number;
}

export function createFaceControls(): FaceControls {
  return {
    smileLeft: 0,
    smileRight: 0,

    frownLeft: 0,
    frownRight: 0,

    blinkLeft: 0,
    blinkRight: 0,

    browUpLeft: 0,
    browUpRight: 0,

    browDownLeft: 0,
    browDownRight: 0,

    jawOpen: 0,
    jawForward: 0,

    mouthOpen: 0,
    mouthPucker: 0,

    cheekRaiseLeft: 0,
    cheekRaiseRight: 0,

    noseWrinkle: 0,

    squintLeft: 0,
    squintRight: 0
  };
}

/** Map controls onto morph-name weights (engine morph naming). */
export function applyFaceControls(
  controls: FaceControls,
  morphs: Map<string, number>
): void {
  morphs.set('smile_L', controls.smileLeft);
  morphs.set('smile_R', controls.smileRight);
  morphs.set('frown_L', controls.frownLeft);
  morphs.set('frown_R', controls.frownRight);
  morphs.set('blink_L', controls.blinkLeft);
  morphs.set('blink_R', controls.blinkRight);
  morphs.set('brow_up_L', controls.browUpLeft);
  morphs.set('brow_up_R', controls.browUpRight);
  morphs.set('brow_down_L', controls.browDownLeft);
  morphs.set('brow_down_R', controls.browDownRight);
  morphs.set('jaw_open', controls.jawOpen);
  morphs.set('jaw_forward', controls.jawForward);
  morphs.set('mouth_open', controls.mouthOpen);
  morphs.set('mouth_pucker', controls.mouthPucker);
  morphs.set('cheek_raise_L', controls.cheekRaiseLeft);
  morphs.set('cheek_raise_R', controls.cheekRaiseRight);
  morphs.set('nose_wrinkle', controls.noseWrinkle);
  morphs.set('squint_L', controls.squintLeft);
  morphs.set('squint_R', controls.squintRight);
}

/** Clamped setter + reset for the control set. */
export class FaceExpressionController {
  readonly controls: FaceControls;

  constructor() {
    this.controls = createFaceControls();
  }

  set(name: keyof FaceControls, value: number): void {
    this.controls[name] = Math.max(0, Math.min(1, value));
  }

  reset(): void {
    for (const key of Object.keys(this.controls) as Array<keyof FaceControls>) {
      this.controls[key] = 0;
    }
  }
}

/** Natural blink: continuous eyelid motion instead of a binary snap. */
export class BlinkController {
  private phase = 0;
  private timer = 0;

  update(deltaSeconds: number, left: FaceControls, right: FaceControls): void {
    this.timer += deltaSeconds;

    if (this.timer > 3.0 + Math.random() * 4.0) {
      this.timer = 0;
      this.phase = 0.0001;
    }

    if (this.phase > 0) {
      this.phase += deltaSeconds * 5.0;

      const blink = Math.sin(Math.min(this.phase, Math.PI));

      left.blinkLeft = blink;
      right.blinkRight = blink;

      if (this.phase >= Math.PI) {
        this.phase = 0;
      }
    }
  }
}

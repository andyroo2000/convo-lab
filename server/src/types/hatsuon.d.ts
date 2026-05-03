declare module 'hatsuon' {
  export interface HatsuonInput {
    reading: string;
    pitchNum: number;
  }

  export interface HatsuonResult extends HatsuonInput {
    morae: string[];
    pattern: number[];
    patternName: string;
  }

  export function hatsuon(input: HatsuonInput): HatsuonResult;
}

export interface TextSegment {
  id: string;
  original: string;
  translation: string;
}

export interface SegmentResponse {
  segments: TextSegment[];
}

export enum PlaybackState {
  IDLE = 'IDLE',
  LOADING_AUDIO = 'LOADING_AUDIO',
  PLAYING = 'PLAYING',
}

// Shapes shared by the brief, the wizard and the library reader.

export interface LibraryStyle {
  slug: string; summary: string; character: string;
  uses: string[]; avoids: string[]; formats: string[];
  duration: { min: number; max: number };
  /** Seconds per beat, when the style sets its own rhythm. */
  beat?: number | undefined;
  /** "calm" when the look wants quiet transitions. */
  transitions?: 'standard' | 'calm' | undefined;
}
export interface LibraryBeat { name: string; share: number; content: string; primitives: string[] }
/** What a video is for, as the wizard groups video types. */
export type Family = 'product' | 'brand' | 'graphics' | 'social';
export interface LibraryNarrative { slug: string; summary: string; family: Family; duration: { min: number; max: number }; fits: string[]; beats: LibraryBeat[] }
export interface LibraryPrimitive { slug: string; summary: string; status: string }
export interface Library { styles: LibraryStyle[]; narratives: LibraryNarrative[]; primitives: LibraryPrimitive[] }

export type Feel = 'calm' | 'crisp' | 'lively';
export type Format = '16:9' | '1:1' | '4:5' | '9:16';
/** Who reads the brief: an agent working in this repository, or a chat assistant with no tools. */
export type Target = 'agent' | 'chat';

/** Everything the wizard asks. The brief is a pure function of this. */
export interface Answers {
  /** A narrative slug: the kind of video. */
  type: string;
  /** A style slug: the look. */
  style: string;
  feel: Feel;
  /** What the video is about, in a few words. Used as its title. */
  subject: string;
  /** The one thing a viewer should remember. */
  message: string;
  /** What the viewer should feel or do afterwards. */
  intent: string;
  audience?: string;
  /** Lines, numbers and names the video should use, one per line. */
  content?: string;
  avoid?: string;
  /** Seconds. */
  duration: number;
  formats: Format[];
  accent?: string;
  scheme?: 'light' | 'dark';
  /** Primitive slugs the person picked on top of the ones the story suggests. */
  moves?: string[];
  target: Target;
}

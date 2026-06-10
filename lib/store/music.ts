"use client";

import { create } from "zustand";

export type Track = {
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  duration: number;
};

type MusicState = {
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;

  playTrack: (track: Track) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  clearQueue: () => void;
  updateTime: (time: number, dur: number) => void;
  reset: () => void;
};

export const useMusic = create<MusicState>((set, get) => ({
  queue: [],
  currentTrack: null,
  isPlaying: false,
  volume: 80,
  currentTime: 0,
  duration: 0,

  playTrack: (track) => {
    const { currentTrack } = get();
    if (currentTrack && currentTrack.videoId === track.videoId) {
      set({ isPlaying: true, currentTime: 0 });
    } else {
      set({
        currentTrack: track,
        isPlaying: true,
        currentTime: 0,
        duration: track.duration,
      });
    }
  },

  addToQueue: (track) =>
    set((state) => ({
      queue: [...state.queue, track],
    })),

  removeFromQueue: (index) =>
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index),
    })),

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  next: () => {
    const { queue, currentTrack } = get();
    if (queue.length === 0) {
      set({ currentTrack: null, isPlaying: false, currentTime: 0, duration: 0 });
      return;
    }
    const currentIndex = currentTrack
      ? queue.findIndex((t) => t.videoId === currentTrack.videoId)
      : -1;
    const nextIndex = (currentIndex + 1) % queue.length;
    const nextTrack = queue[nextIndex];
    set({
      currentTrack: nextTrack,
      isPlaying: true,
      currentTime: 0,
      duration: nextTrack.duration,
    });
  },

  prev: () => {
    const { currentTime, queue, currentTrack } = get();
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }
    if (queue.length === 0) {
      set({ currentTrack: null, isPlaying: false, currentTime: 0, duration: 0 });
      return;
    }
    const currentIndex = currentTrack
      ? queue.findIndex((t) => t.videoId === currentTrack.videoId)
      : 0;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    const prevTrack = queue[prevIndex];
    set({
      currentTrack: prevTrack,
      isPlaying: true,
      currentTime: 0,
      duration: prevTrack.duration,
    });
  },

  seek: (seconds) => set({ currentTime: Math.max(0, seconds) }),

  setVolume: (vol) => set({ volume: Math.max(0, Math.min(100, vol)) }),

  clearQueue: () => set({ queue: [] }),

  updateTime: (time, dur) =>
    set({ currentTime: time, duration: dur || get().duration }),

  reset: () =>
    set({
      queue: [],
      currentTrack: null,
      isPlaying: false,
      volume: 80,
      currentTime: 0,
      duration: 0,
    }),
}));

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

export type SkillRecord = {
  id: string;
  name: string;
  description: string;
  content: string;
  fromStore?: string;
};

export type SkillsState = {
  skills: SkillRecord[];
  addSkill: (skill: Omit<SkillRecord, "id">) => void;
  updateSkill: (id: string, skill: Partial<Omit<SkillRecord, "id">>) => void;
  deleteSkill: (id: string) => void;
};

export const useSkills = create<SkillsState>()(
  persist(
    (set) => ({
      skills: [],
      addSkill: (skill) =>
        set((state) => ({
          skills: [...state.skills, { ...skill, id: nanoid(8) }],
        })),
      updateSkill: (id, updated) =>
        set((state) => ({
          skills: state.skills.map((s) => (s.id === id ? { ...s, ...updated } : s)),
        })),
      deleteSkill: (id) =>
        set((state) => ({
          skills: state.skills.filter((s) => s.id !== id),
        })),
    }),
    {
      name: "orbit-skills",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

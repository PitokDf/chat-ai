"use client";

import { useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Folder,
} from "lucide-react";

import { useWorkspace } from "@/lib/store/workspace";
import { useState } from "react";

type Node = {
  name: string;
  path: string;
  isFile: boolean;
  children: Node[];
};

const buildTree = (paths: string[]): Node => {
  const root: Node = { name: "/", path: "", isFile: false, children: [] };
  const sorted = [...paths].sort();
  for (const path of sorted) {
    const parts = path.split("/").filter(Boolean);
    let parent = root;
    let current = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      current = current ? `${current}/${part}` : part;
      const isFile = i === parts.length - 1;
      let node = parent.children.find((child) => child.name === part);
      if (!node) {
        node = { name: part, path: current, isFile, children: [] };
        parent.children.push(node);
      }
      parent = node;
    }
  }
  const sortNodes = (node: Node) => {
    node.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortNodes);
  };
  sortNodes(root);
  return root;
};

const FileRow = ({
  node,
  depth,
  expanded,
  toggle,
  openFile,
  setOpenFile,
}: {
  node: Node;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  openFile: string | null;
  setOpenFile: (path: string) => void;
}) => {
  if (node.isFile) {
    const isActive = openFile === node.path;
    return (
      <button
        type="button"
        onClick={() => setOpenFile(node.path)}
        className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] transition hover:bg-muted/60 ${
          isActive ? "bg-muted text-foreground" : "text-muted-foreground"
        }`}
        style={{ paddingLeft: depth * 10 + 6 }}
      >
        <FileIcon className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">{node.name}</span>
      </button>
    );
  }

  const isExpanded = expanded.has(node.path);
  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(node.path)}
        className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[12px] text-foreground/80 transition hover:bg-muted/60"
        style={{ paddingLeft: depth * 10 + 6 }}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Folder className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">{node.name}</span>
      </button>
      {isExpanded
        ? node.children.map((child) => (
            <FileRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              openFile={openFile}
              setOpenFile={setOpenFile}
            />
          ))
        : null}
    </div>
  );
};

export function FileTree() {
  const files = useWorkspace((s) => s.files);
  const openFile = useWorkspace((s) => s.openFile);
  const setOpenFile = useWorkspace((s) => s.setOpenFile);

  const tree = useMemo(() => buildTree(Object.keys(files)), [files]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (Object.keys(files).length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
        Files created by the agent will appear here.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto py-2 pr-1">
      {tree.children.map((child) => (
        <FileRow
          key={child.path}
          node={child}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          openFile={openFile}
          setOpenFile={setOpenFile}
        />
      ))}
    </div>
  );
}

import type { DocumentSession } from "@/types/document";
import { parentDirName } from "./path";

/** Tab label: when several open tabs share a file name, disambiguate with
 * the parent directory (SPEC: 重名显示父目录). Untitled docs never clash
 * because their names are numbered. */
export function tabLabel(
  doc: Pick<DocumentSession, "displayName" | "filePath">,
  all: Array<Pick<DocumentSession, "displayName">>,
): string {
  const clash = all.filter((d) => d.displayName === doc.displayName).length > 1;
  if (!clash || !doc.filePath) return doc.displayName;
  const parent = parentDirName(doc.filePath);
  return parent && parent !== "." ? `${parent} / ${doc.displayName}` : doc.displayName;
}

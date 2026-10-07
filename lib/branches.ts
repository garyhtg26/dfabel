import { z } from "zod";
export const branchSchema = z.enum(["cinere", "bogor"]);
export type BranchId = z.infer<typeof branchSchema>;
export const branches: Record<BranchId, string> = {
  cinere: "Cinere",
  bogor: "Bogor",
};
export function requestBranch(url: string): BranchId {
  return branchSchema.parse(
    new URL(url).searchParams.get("branch") ?? "cinere",
  );
}
export function branchMediaPath(branch: BranchId, slot: string) {
  return branch === "cinere"
    ? `banners/${slot}/image.jpg`
    : `banners/bogor/${slot}/image.jpg`;
}

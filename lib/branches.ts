import { z } from "zod";
export const branchSchema = z.enum(["cinere", "bogor"]);
export type BranchId = z.infer<typeof branchSchema>;

export type BranchLocation = {
  name: string;
  area: string;
  latitude: number;
  longitude: number;
};

export const branches: Record<BranchId, string> = {
  cinere: "Cinere",
  bogor: "Bogor",
};

export const branchLocations: Record<BranchId, BranchLocation> = {
  cinere: {
    name: "D’Fable Cinere",
    area: "Cinere, Depok",
    latitude: -6.3286,
    longitude: 106.7844,
  },
  bogor: {
    name: "D’Fable Bogor",
    area: "Bogor",
    latitude: -6.5971,
    longitude: 106.806,
  },
};

export function isBranchId(value: unknown): value is BranchId {
  return branchSchema.safeParse(value).success;
}

function distanceKm(
  latitude: number,
  longitude: number,
  branch: BranchLocation,
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(branch.latitude - latitude);
  const longitudeDelta = radians(branch.longitude - longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitude)) *
      Math.cos(radians(branch.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestBranch(
  latitude: number,
  longitude: number,
): BranchId {
  return (Object.keys(branchLocations) as BranchId[]).reduce(
    (nearest, candidate) =>
      distanceKm(latitude, longitude, branchLocations[candidate]) <
      distanceKm(latitude, longitude, branchLocations[nearest])
        ? candidate
        : nearest,
    "cinere",
  );
}

export function resolveCustomerBranch({
  detected,
  requested,
  saved,
}: {
  detected?: { latitude: number; longitude: number } | null;
  requested?: unknown;
  saved?: unknown;
}): BranchId {
  if (
    detected &&
    Number.isFinite(detected.latitude) &&
    Number.isFinite(detected.longitude)
  )
    return nearestBranch(detected.latitude, detected.longitude);
  if (isBranchId(requested)) return requested;
  if (isBranchId(saved)) return saved;
  return "cinere";
}

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

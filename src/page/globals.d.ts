// Page modules share one scope after the build (scripts/build.mjs); declare cross-module names for tsc.
declare const claude: any;
declare function subscribeTodos(
  onRows: (rows: any[]) => void,
  onError?: (err: unknown) => void,
): Promise<boolean>;

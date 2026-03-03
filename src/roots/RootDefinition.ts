export interface RootDefinition {
  prefix: string;
  path: string;
  enabled: boolean;
  source: "builtin" | "custom";
}

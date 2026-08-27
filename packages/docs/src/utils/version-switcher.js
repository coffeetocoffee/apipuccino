/**
 * Version switcher: input string|string[] -> dropdown
 * Config input: string | string[] maps to ./api-docs/v1/, ./api-docs/v2/
 */
export function buildVersionOptions(cfg) {
  const inputs = Array.isArray(cfg.input) ? cfg.input : [cfg.input];
  if (inputs.length <= 1) return "";
  return inputs.map((p,i) => `<option value="./v${i+1}/index.html" ${i===0?"selected":""}>v${i+1}: ${typeof p==="string"?p.split("/").pop():p} — ${cfg.title||"API"}</option>`).join("");
}
export function versionedOutputs(cfg) {
  const inputs = Array.isArray(cfg.input) ? cfg.input : [cfg.input];
  return inputs.map((inp,i) => ({ input: inp, output: inputs.length>1 ? `${cfg.output}/v${i+1}` : cfg.output, version: `v${i+1}` }));
}

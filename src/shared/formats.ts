export const SUPPORTED_EXTENSIONS = ['glb', 'gltf', 'obj', 'stl', 'ply', '3mf'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

const EXT_SET = new Set<string>(SUPPORTED_EXTENSIONS);

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return EXT_SET.has(ext.toLowerCase());
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}

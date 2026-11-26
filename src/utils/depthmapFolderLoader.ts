import { DecodedDepthmap, DepthmapEntry } from '../types/index.ts';
import {
  formatDepthmapTitle,
  isSupportedImageFilename,
  rgbaToGrayscaleDepth,
  sortDepthmapEntries,
} from '../core/depthmapBrowser.ts';

export interface LoadedDepthmapFolder {
  folderName: string;
  source: 'project' | 'local';
  entries: DepthmapEntry[];
  /** Revokes any Object URLs created for a local folder. No-op for project assets. */
  cleanup: () => void;
}

// Vite resolves and serves every image in the project's top-level `depthmaps/` folder
// in both dev mode (live HMR) and production builds.
const PROJECT_DEPTHMAP_MODULES = import.meta.glob<string>(
  '../../depthmaps/**/*.{png,jpg,jpeg,webp,gif,bmp,avif,PNG,JPG,JPEG,WEBP,GIF,BMP,AVIF}',
  { eager: true, query: '?url', import: 'default' }
);

/**
 * Returns the default folder pointing to the project's `depthmaps/` directory.
 */
export function getProjectDepthmapsFolder(): LoadedDepthmapFolder {
  const rawEntries: DepthmapEntry[] = [];

  for (const [modulePath, assetUrl] of Object.entries(PROJECT_DEPTHMAP_MODULES)) {
    const normalized = modulePath.replace(/\\/g, '/');
    const marker = '/depthmaps/';
    const idx = normalized.indexOf(marker);
    const relativePath = idx >= 0 ? normalized.slice(idx + marker.length) : normalized.split('/').pop() ?? normalized;
    const fileName = relativePath.split('/').pop() ?? relativePath;

    if (!isSupportedImageFilename(fileName)) continue;

    rawEntries.push({
      id: `project:${relativePath}`,
      name: formatDepthmapTitle(fileName),
      fileName,
      relativePath,
      url: assetUrl,
      source: 'project',
    });
  }

  return {
    folderName: 'depthmaps',
    source: 'project',
    entries: sortDepthmapEntries(rawEntries),
    cleanup: () => {},
  };
}

// Minimal structural types for File System Access API (not yet in all TS DOM libs)
interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandleLike>;
}

interface FileSystemHandleLike {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandleLike extends FileSystemHandleLike {
  kind: 'file';
  getFile: () => Promise<File>;
}

interface FileSystemDirectoryHandleLike extends FileSystemHandleLike {
  kind: 'directory';
  values: () => AsyncIterable<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
}

/**
 * Checks whether the browser supports native File System Access directory selection.
 */
export function supportsDirectoryPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
  );
}

/**
 * Recursively collects image files from a FileSystemDirectoryHandle.
 */
async function collectFilesFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandleLike,
  prefix: string = ''
): Promise<Array<{ file: File; relativePath: string }>> {
  const collected: Array<{ file: File; relativePath: string }> = [];

  for await (const handle of dirHandle.values()) {
    const relPath = prefix ? `${prefix}/${handle.name}` : handle.name;
    if (handle.kind === 'file') {
      if (isSupportedImageFilename(handle.name)) {
        const file = await handle.getFile();
        collected.push({ file, relativePath: relPath });
      }
    } else if (handle.kind === 'directory') {
      // Skip hidden system directories like .git
      if (handle.name.startsWith('.')) continue;
      const nested = await collectFilesFromDirectoryHandle(handle, relPath);
      collected.push(...nested);
    }
  }

  return collected;
}

/**
 * Opens the native folder picker via File System Access API.
 * Returns null if the user cancelled the dialog.
 */
export async function pickLocalFolderWithDirectoryPicker(): Promise<LoadedDepthmapFolder | null> {
  const win = window as DirectoryPickerWindow;
  if (typeof win.showDirectoryPicker !== 'function') {
    throw new Error('Directory picker is not supported in this browser.');
  }

  try {
    const dirHandle = await win.showDirectoryPicker({
      id: 'stereocraft-depthmaps',
      mode: 'read',
    });

    const files = await collectFilesFromDirectoryHandle(dirHandle);
    const createdUrls: string[] = [];

    const entries: DepthmapEntry[] = files.map(({ file, relativePath }) => {
      const url = URL.createObjectURL(file);
      createdUrls.push(url);
      return {
        id: `local:${dirHandle.name}/${relativePath}:${file.lastModified}`,
        name: formatDepthmapTitle(file.name),
        fileName: file.name,
        relativePath,
        url,
        source: 'local',
      };
    });

    return {
      folderName: dirHandle.name,
      source: 'local',
      entries: sortDepthmapEntries(entries),
      cleanup: () => {
        for (const url of createdUrls) {
          URL.revokeObjectURL(url);
        }
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null; // User cancelled picker
    }
    throw err;
  }
}

/**
 * Fallback loader for `<input type="file" webkitdirectory multiple />`.
 */
export function loadLocalFolderFromFileList(fileList: FileList | File[]): LoadedDepthmapFolder {
  const files = Array.from(fileList);
  const createdUrls: string[] = [];
  const entries: DepthmapEntry[] = [];

  let detectedFolderName = 'Custom Folder';

  for (const file of files) {
    const webkitRel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
    if (webkitRel && detectedFolderName === 'Custom Folder') {
      const rootSegment = webkitRel.split('/')[0];
      if (rootSegment) detectedFolderName = rootSegment;
    }

    if (!isSupportedImageFilename(file.name) && !file.type.startsWith('image/')) {
      continue;
    }

    const relativePath = webkitRel
      ? webkitRel.split('/').slice(1).join('/') || file.name
      : file.name;

    const url = URL.createObjectURL(file);
    createdUrls.push(url);

    entries.push({
      id: `local:${relativePath}:${file.lastModified}:${file.size}`,
      name: formatDepthmapTitle(file.name),
      fileName: file.name,
      relativePath,
      url,
      source: 'local',
    });
  }

  return {
    folderName: detectedFolderName,
    source: 'local',
    entries: sortDepthmapEntries(entries),
    cleanup: () => {
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    },
  };
}

/**
 * Decodes an image URL into a normalized grayscale depth buffer [0..255].
 */
export function decodeDepthmapFromUrl(url: string): Promise<DecodedDepthmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w <= 0 || h <= 0) {
          reject(new Error(`Invalid image dimensions for ${url}`));
          return;
        }
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
          reject(new Error('Unable to acquire 2D canvas context.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const raw = ctx.getImageData(0, 0, w, h);
        const gray = rgbaToGrayscaleDepth(raw.data, w * h);
        resolve({ data: gray, width: w, height: h });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error(`Failed to load depthmap image: ${url}`));
    };
    img.src = url;
  });
}

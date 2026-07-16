export const processAssetPath = (path: string): string => {
  // for storybook
  if (chrome?.runtime === undefined) return path
  return chrome.runtime.getURL(path)
}

export const waitFor = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export const genUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export const downloadBlob = async (blob: Blob, filename: string): Promise<void> => {
  // iOS WebKit doesn't support blob URL downloads (WebKitBlobResource error 1).
  // Use the Web Share API with a File object instead, which triggers the share sheet.
  if (isIOS()) {
    const file = new File([blob], filename, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] })
      return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

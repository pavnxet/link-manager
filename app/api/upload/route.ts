import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  IMGBB_MAX_BYTES,
  ImgbbError,
  detectImageType,
  uploadImageToImgbb,
} from '@/lib/imgbb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const IMAGE_CATEGORY = '🖼️ #Image'

type UploadedFile = {
  name?: string
  size?: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

function isUploadedFile(value: unknown): value is UploadedFile {
  const file = value as UploadedFile | null
  return !!file && typeof file.arrayBuffer === 'function' && typeof file.size === 'number'
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected a multipart/form-data body with an "image" field' },
      { status: 400 },
    )
  }

  const file = form.get('image')
  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: 'No image file provided (field "image")' }, { status: 400 })
  }

  if (!file.size) {
    return NextResponse.json({ error: 'The uploaded file is empty' }, { status: 400 })
  }

  if (file.size > IMGBB_MAX_BYTES) {
    return NextResponse.json({ error: 'Image is larger than the 32 MB ImgBB limit' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectImageType(bytes)
  if (!mimeType) {
    return NextResponse.json(
      { error: 'Unsupported file type. Drop a PNG, JPEG, GIF, WebP, BMP, TIFF, AVIF or SVG image.' },
      { status: 415 },
    )
  }

  let image
  try {
    image = await uploadImageToImgbb(
      { bytes, filename: file.name },
      { apiKey: process.env.IMGBB_API_KEY },
    )
  } catch (err: unknown) {
    if (err instanceof ImgbbError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('Image upload error:', err)
    return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
  }

  // The image is hosted now; save it in the vault as a link entry.
  try {
    const db = await getDb()
    const nextId = await db.getNextNumericId()
    const link = await db.addLink({
      title: String(nextId),
      page_title: file.name || 'Uploaded image',
      url: image.url,
      category: IMAGE_CATEGORY,
    })
    return NextResponse.json({ image, link }, { status: 201 })
  } catch (err: unknown) {
    console.error('Failed to save uploaded image as a link:', err)
    return NextResponse.json(
      {
        image,
        link: null,
        warning: 'Image uploaded to ImgBB but could not be saved to your vault',
      },
      { status: 201 },
    )
  }
}

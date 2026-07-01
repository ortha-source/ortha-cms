import { MEDIA_KIND } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';

/**
 * Seed folders for the Media Library mockup. A shallow two-level tree under the
 * synthetic root so folder navigation, breadcrumbs, and move-to-folder all have
 * something real to exercise. Swap for a `GET /api/media/folders` read later.
 */
export const MOCK_FOLDERS: MediaFolder[] = [
    { id: 'f-brand', name: 'Brand', parentId: 'root', createdAt: '2026-02-03T09:00:00Z' },
    { id: 'f-product', name: 'Product Shots', parentId: 'root', createdAt: '2026-02-10T09:00:00Z' },
    { id: 'f-marketing', name: 'Marketing', parentId: 'root', createdAt: '2026-03-01T09:00:00Z' },
    { id: 'f-video', name: 'Video', parentId: 'root', createdAt: '2026-03-14T09:00:00Z' },
    { id: 'f-docs', name: 'Documents', parentId: 'root', createdAt: '2026-04-02T09:00:00Z' },
    { id: 'f-logos', name: 'Logos', parentId: 'f-brand', createdAt: '2026-02-04T09:00:00Z' },
    { id: 'f-social', name: 'Social', parentId: 'f-marketing', createdAt: '2026-03-05T09:00:00Z' }
];

/**
 * Seed assets for the Media Library mockup — a spread of images, video, audio,
 * documents, and an archive across the root and the seed folders, with varied
 * sizes/dimensions/tags so the grid, list, detail drawer, filters, and sort all
 * have realistic data to render. Swap for `GET /api/media/assets` later.
 */
export const MOCK_ASSETS: MediaAsset[] = [
    {
        id: 'a-hero',
        name: 'homepage-hero.jpg',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/jpeg',
        size: 2_411_000,
        folderId: 'root',
        dimensions: { width: 2400, height: 1350 },
        tags: ['hero', 'homepage'],
        alt: 'Team collaborating around a laptop',
        uploadedBy: 'Ada Lovelace',
        createdAt: '2026-06-21T14:12:00Z',
        updatedAt: '2026-06-21T14:12:00Z'
    },
    {
        id: 'a-launch-video',
        name: 'launch-teaser.mp4',
        kind: MEDIA_KIND.Video,
        mimeType: 'video/mp4',
        size: 48_200_000,
        folderId: 'root',
        dimensions: { width: 1920, height: 1080 },
        duration: 92,
        tags: ['launch', 'campaign'],
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-06-19T10:40:00Z',
        updatedAt: '2026-06-20T08:05:00Z'
    },
    {
        id: 'a-podcast',
        name: 'ep-14-interview.mp3',
        kind: MEDIA_KIND.Audio,
        mimeType: 'audio/mpeg',
        size: 18_900_000,
        folderId: 'root',
        duration: 2734,
        tags: ['podcast'],
        uploadedBy: 'Alan Turing',
        createdAt: '2026-06-18T16:20:00Z',
        updatedAt: '2026-06-18T16:20:00Z'
    },
    {
        id: 'a-whitepaper',
        name: 'platform-whitepaper.pdf',
        kind: MEDIA_KIND.Document,
        mimeType: 'application/pdf',
        size: 3_120_000,
        folderId: 'root',
        tags: ['sales', 'pdf'],
        uploadedBy: 'Ada Lovelace',
        createdAt: '2026-06-15T09:30:00Z',
        updatedAt: '2026-06-16T11:00:00Z'
    },
    {
        id: 'a-logo-primary',
        name: 'ortha-logo-primary.svg',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/svg+xml',
        size: 42_000,
        folderId: 'f-logos',
        dimensions: { width: 512, height: 512 },
        tags: ['logo', 'brand'],
        alt: 'Ortha primary logo',
        uploadedBy: 'Katherine Johnson',
        createdAt: '2026-02-05T12:00:00Z',
        updatedAt: '2026-05-02T09:15:00Z'
    },
    {
        id: 'a-logo-mono',
        name: 'ortha-logo-mono.svg',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/svg+xml',
        size: 38_500,
        folderId: 'f-logos',
        dimensions: { width: 512, height: 512 },
        tags: ['logo', 'brand', 'mono'],
        alt: 'Ortha monochrome logo',
        uploadedBy: 'Katherine Johnson',
        createdAt: '2026-02-05T12:04:00Z',
        updatedAt: '2026-02-05T12:04:00Z'
    },
    {
        id: 'a-brand-guide',
        name: 'brand-guidelines.pdf',
        kind: MEDIA_KIND.Document,
        mimeType: 'application/pdf',
        size: 8_640_000,
        folderId: 'f-brand',
        tags: ['brand', 'guidelines'],
        uploadedBy: 'Katherine Johnson',
        createdAt: '2026-02-06T15:22:00Z',
        updatedAt: '2026-04-11T10:00:00Z'
    },
    {
        id: 'a-palette',
        name: 'color-palette.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 640_000,
        folderId: 'f-brand',
        dimensions: { width: 1600, height: 900 },
        tags: ['brand', 'color'],
        alt: 'Brand colour palette swatches',
        uploadedBy: 'Katherine Johnson',
        createdAt: '2026-02-07T11:10:00Z',
        updatedAt: '2026-02-07T11:10:00Z'
    },
    {
        id: 'a-product-01',
        name: 'device-front.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 1_820_000,
        folderId: 'f-product',
        dimensions: { width: 2000, height: 2000 },
        tags: ['product', 'device'],
        alt: 'Product device, front view',
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-02-12T13:00:00Z',
        updatedAt: '2026-02-12T13:00:00Z'
    },
    {
        id: 'a-product-02',
        name: 'device-angle.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 1_910_000,
        folderId: 'f-product',
        dimensions: { width: 2000, height: 2000 },
        tags: ['product', 'device'],
        alt: 'Product device, three-quarter view',
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-02-12T13:04:00Z',
        updatedAt: '2026-02-12T13:04:00Z'
    },
    {
        id: 'a-product-03',
        name: 'device-detail.jpg',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/jpeg',
        size: 2_240_000,
        folderId: 'f-product',
        dimensions: { width: 3000, height: 2000 },
        tags: ['product', 'macro'],
        alt: 'Close-up of the device texture',
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-02-13T09:45:00Z',
        updatedAt: '2026-02-13T09:45:00Z'
    },
    {
        id: 'a-lifestyle',
        name: 'lifestyle-desk.jpg',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/jpeg',
        size: 3_050_000,
        folderId: 'f-product',
        dimensions: { width: 2800, height: 1867 },
        tags: ['lifestyle'],
        alt: 'Device in use on a bright desk',
        uploadedBy: 'Ada Lovelace',
        createdAt: '2026-03-02T10:00:00Z',
        updatedAt: '2026-03-02T10:00:00Z'
    },
    {
        id: 'a-social-01',
        name: 'instagram-story-q3.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 980_000,
        folderId: 'f-social',
        dimensions: { width: 1080, height: 1920 },
        tags: ['social', 'instagram'],
        alt: 'Q3 Instagram story template',
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-03-06T12:30:00Z',
        updatedAt: '2026-03-06T12:30:00Z'
    },
    {
        id: 'a-social-02',
        name: 'linkedin-banner.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 1_120_000,
        folderId: 'f-social',
        dimensions: { width: 1584, height: 396 },
        tags: ['social', 'linkedin'],
        alt: 'LinkedIn banner artwork',
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-03-07T09:00:00Z',
        updatedAt: '2026-03-18T14:20:00Z'
    },
    {
        id: 'a-campaign-brief',
        name: 'q3-campaign-brief.docx',
        kind: MEDIA_KIND.Document,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 540_000,
        folderId: 'f-marketing',
        tags: ['campaign', 'brief'],
        uploadedBy: 'Ada Lovelace',
        createdAt: '2026-03-03T08:15:00Z',
        updatedAt: '2026-03-09T16:45:00Z'
    },
    {
        id: 'a-explainer',
        name: 'product-explainer.mp4',
        kind: MEDIA_KIND.Video,
        mimeType: 'video/mp4',
        size: 120_400_000,
        folderId: 'f-video',
        dimensions: { width: 3840, height: 2160 },
        duration: 214,
        tags: ['explainer', '4k'],
        uploadedBy: 'Alan Turing',
        createdAt: '2026-03-15T11:00:00Z',
        updatedAt: '2026-03-15T11:00:00Z'
    },
    {
        id: 'a-testimonial',
        name: 'customer-testimonial.mov',
        kind: MEDIA_KIND.Video,
        mimeType: 'video/quicktime',
        size: 86_700_000,
        folderId: 'f-video',
        dimensions: { width: 1920, height: 1080 },
        duration: 138,
        tags: ['testimonial'],
        uploadedBy: 'Alan Turing',
        createdAt: '2026-03-20T13:30:00Z',
        updatedAt: '2026-03-20T13:30:00Z'
    },
    {
        id: 'a-jingle',
        name: 'brand-jingle.wav',
        kind: MEDIA_KIND.Audio,
        mimeType: 'audio/wav',
        size: 6_200_000,
        folderId: 'f-brand',
        duration: 18,
        tags: ['brand', 'audio'],
        uploadedBy: 'Katherine Johnson',
        createdAt: '2026-02-08T10:00:00Z',
        updatedAt: '2026-02-08T10:00:00Z'
    },
    {
        id: 'a-press-kit',
        name: 'press-kit.zip',
        kind: MEDIA_KIND.Archive,
        mimeType: 'application/zip',
        size: 54_300_000,
        folderId: 'root',
        tags: ['press', 'download'],
        uploadedBy: 'Ada Lovelace',
        createdAt: '2026-05-28T09:00:00Z',
        updatedAt: '2026-05-28T09:00:00Z'
    },
    {
        id: 'a-onepager',
        name: 'sales-onepager.pdf',
        kind: MEDIA_KIND.Document,
        mimeType: 'application/pdf',
        size: 1_240_000,
        folderId: 'f-docs',
        tags: ['sales'],
        uploadedBy: 'Ada Lovelace',
        createdAt: '2026-04-03T09:00:00Z',
        updatedAt: '2026-04-03T09:00:00Z'
    },
    {
        id: 'a-spec-sheet',
        name: 'technical-spec-sheet.pdf',
        kind: MEDIA_KIND.Document,
        mimeType: 'application/pdf',
        size: 2_050_000,
        folderId: 'f-docs',
        tags: ['spec', 'technical'],
        uploadedBy: 'Alan Turing',
        createdAt: '2026-04-05T14:00:00Z',
        updatedAt: '2026-05-01T10:30:00Z'
    },
    {
        id: 'a-favicon',
        name: 'favicon-source.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 21_000,
        folderId: 'f-logos',
        dimensions: { width: 256, height: 256 },
        tags: ['logo', 'favicon'],
        alt: 'Favicon source artwork',
        uploadedBy: 'Katherine Johnson',
        createdAt: '2026-02-09T09:00:00Z',
        updatedAt: '2026-02-09T09:00:00Z'
    },
    {
        id: 'a-map',
        name: 'office-map.png',
        kind: MEDIA_KIND.Image,
        mimeType: 'image/png',
        size: 720_000,
        folderId: 'root',
        dimensions: { width: 1400, height: 1000 },
        tags: ['misc'],
        alt: 'Illustrated office floor map',
        uploadedBy: 'Grace Hopper',
        createdAt: '2026-06-01T09:00:00Z',
        updatedAt: '2026-06-01T09:00:00Z'
    }
];
